import { prisma } from '@/lib/prisma'
import { verificarEstoqueTiny } from '@/lib/tiny/verificar-estoque'
import { itensParaVerificarNoTiny } from '@/lib/checkout/estoque-webhook'
import { consumirReservaDoPedido } from '@/lib/checkout/reserva'
import {
  validarPagamentoDoPedido,
  valorTotalPagamentoMP,
  type PagamentoMPNormalizado,
} from '@/lib/checkout/mercadopago-webhook'
import {
  agendarReembolso,
  cancelarPedidoPagoComEstorno,
  processarReembolso,
  registrarTentativaPagamento,
  type ReembolsoDeps,
} from '@/lib/checkout/pagamento'
import { agendarNotificacoesClientePedido } from '@/lib/checkout/notificacoes-pedido'
import { aplicarBeneficiosPedidoPirelliPago } from '@/lib/checkout/beneficios-evento-pirelli'
import { SKU_CANECA_EVENTO_PIRELLI } from '@/lib/checkout/caneca-evento-pirelli'
import { pagamentoCompativelComCheckout } from '@/lib/checkout/desconto-avista'
import { pagamentoCanecaPirelliPermitido } from '@/lib/mercadopago'
import {
  calcularExpiracaoCompensacao,
  pagamentoEmProcessamento,
} from '@/lib/checkout/prazos-pagamento'

/**
 * Máquina de estados do pagamento de um pedido, isolada da rota para poder
 * ser exercitada sem tocar em nenhum serviço externo.
 *
 * O que ela garante:
 *   - Uma tentativa REJEITADA não encerra o pedido. A preferência pode receber
 *     outra tentativa dentro da modalidade escolhida; quem devolve os recursos
 *     é a expiração da reserva, não a recusa de um cartão.
 *   - Uma APROVAÇÃO é dominante: se chegar sobre um pedido já encerrado, o
 *     dinheiro não fica sem contrapartida — nasce uma obrigação durável de
 *     estorno e o admin é avisado.
 *   - Cancelar por falta de estoque e registrar o estorno acontecem na mesma
 *     transação; o resultado HTTP do estorno é validado.
 */

export type DesfechoEstorno = 'CONCLUIDO' | 'PENDENTE' | 'FALHOU' | 'IGNORADO'

export type ResultadoWebhookPedido =
  | { tipo: 'pedido_desconhecido' }
  | { tipo: 'ja_processado'; status: string }
  | { tipo: 'confirmado'; orderId: string }
  | { tipo: 'cancelado_sem_estoque'; nomes: string; estorno: DesfechoEstorno }
  | { tipo: 'aprovado_apos_encerramento'; status: string; estorno: DesfechoEstorno }
  | { tipo: 'aprovacao_duplicada'; status: string; estorno: DesfechoEstorno }
  | { tipo: 'metodo_pagamento_invalido'; metodo: string; esperado: string; estorno: DesfechoEstorno }
  | { tipo: 'tentativa_nao_aprovada'; status: string; novo: boolean }

export interface WebhookPedidoDeps {
  verificarEstoque?: typeof verificarEstoqueTiny
  reembolso?: ReembolsoDeps
}

const STATUS_JA_RESOLVIDOS = ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE']

async function processarEstornoRegistrado(
  orderId: string,
  paymentId: string,
  motivo: string,
  deps: WebhookPedidoDeps,
): Promise<DesfechoEstorno> {
  await agendarReembolso({ orderId, paymentId, motivo })
  const linha = await prisma.reembolsoPagamento.findUniqueOrThrow({
    where: { paymentId },
    select: { id: true },
  })
  return processarReembolso(linha.id, deps.reembolso)
}

async function tratarAprovacaoEmPedidoResolvido(
  orderId: string,
  orderNumber: string,
  orderStatus: string,
  paymentId: string,
  deps: WebhookPedidoDeps,
): Promise<ResultadoWebhookPedido> {
  if (orderStatus === 'CANCELADO') {
    const motivo = `Pagamento aprovado após o pedido ${orderNumber} já ter sido encerrado.`
    const estorno = await processarEstornoRegistrado(orderId, paymentId, motivo, deps)
    await prisma.orderTracking.create({
      data: {
        orderId,
        status: 'PAGAMENTO:APROVADO_APOS_CANCELAMENTO',
        descricao: `⚠️ ${motivo} Estorno total registrado e reconciliado até confirmação.`,
      },
    }).catch(() => {})
    return { tipo: 'aprovado_apos_encerramento', status: orderStatus, estorno }
  }

  const outroAprovado = await prisma.pagamentoTentativa.findFirst({
    where: { orderId, status: 'approved', paymentId: { not: paymentId } },
    select: { paymentId: true },
  })
  if (!outroAprovado) return { tipo: 'ja_processado', status: orderStatus }

  const motivo =
    `Cobrança duplicada: pedido ${orderNumber} já estava pago pelo pagamento ` +
    `${outroAprovado.paymentId}.`
  const estorno = await processarEstornoRegistrado(orderId, paymentId, motivo, deps)
  await prisma.orderTracking.create({
    data: {
      orderId,
      status: 'PAGAMENTO:APROVACAO_DUPLICADA',
      descricao: `⚠️ ${motivo} A cobrança ${paymentId} foi encaminhada para estorno total.`,
    },
  }).catch(() => {})
  return { tipo: 'aprovacao_duplicada', status: orderStatus, estorno }
}

export async function processarPagamentoPedido(
  orderId: string,
  paymentId: string,
  payment: PagamentoMPNormalizado,
  deps: WebhookPedidoDeps = {},
): Promise<ResultadoWebhookPedido> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      total: true,
      userId: true,
      canal: true,
      meioPagamentoCheckout: true,
      pagamentoIdExterno: true,
      items: {
        select: {
          productId: true,
          quantidade: true,
          estoqueReservado: true,
          preVendaSnapshot: true,
          product: { select: { nome: true, sku: true } },
        },
      },
    },
  })
  if (!order) return { tipo: 'pedido_desconhecido' }

  const { preferenceId } = await validarPagamentoDoPedido({
    orderId,
    total: Number(order.total),
    preferenceId: order.pagamentoIdExterno,
    payment,
  })

  const { novo } = await registrarTentativaPagamento({
    orderId,
    paymentId,
    status: payment.status,
    metodo: payment.payment_method_id ?? null,
    valor: valorTotalPagamentoMP(payment),
  })

  if (!order.pagamentoIdExterno) {
    await prisma.order.updateMany({
      where: { id: orderId, pagamentoIdExterno: null },
      data: { pagamentoIdExterno: preferenceId, pagamentoMetodo: 'mercadopago' },
    })
  }

  if (payment.status !== 'approved') {
    const emProcessamento = pagamentoEmProcessamento(payment.status)
    if (emProcessamento) {
      const preservarAte = calcularExpiracaoCompensacao()
      await prisma.order.updateMany({
        where: {
          id: orderId,
          status: 'AGUARDANDO_PAGAMENTO',
          OR: [
            { reservaExpiraEm: null },
            { reservaExpiraEm: { lt: preservarAte } },
          ],
        },
        data: { reservaExpiraEm: preservarAte },
      })
    }
    // Rejeição/cancelamento de UMA tentativa: vira histórico, não desfaz nada.
    if (novo) {
      await prisma.orderTracking.create({
        data: {
          orderId,
          status: `PAGAMENTO:${payment.status}`,
          descricao: emProcessamento
            ? `Pagamento ${paymentId} está "${payment.status}". A reserva foi preservada durante o prazo de compensação.`
            : `Tentativa de pagamento ${paymentId} retornou "${payment.status}". ` +
              `A reserva do pedido segue de pé para uma nova tentativa na mesma ` +
              `preferência; ela só é devolvida na expiração.`,
        },
      }).catch(() => {})
    }
    return { tipo: 'tentativa_nao_aprovada', status: payment.status, novo }
  }

  const compraCanecaPirelli = order.canal === 'EVENTO_PIRELLI'
    && order.items.some((item) => item.product.sku === SKU_CANECA_EVENTO_PIRELLI)
  if (compraCanecaPirelli && !pagamentoCanecaPirelliPermitido(payment.payment_method_id)) {
    const metodo = payment.payment_method_id ?? 'não informado'
    const esperado = 'PIX ou saldo Mercado Pago'
    const motivo = `Meio de pagamento não permitido na caneca Pirelli: ${metodo}. A compra aceita Pix ou saldo Mercado Pago.`
    const estorno = await processarEstornoRegistrado(orderId, paymentId, motivo, deps)
    await prisma.orderTracking.create({
      data: {
        orderId,
        status: 'PAGAMENTO:METODO_NAO_PERMITIDO',
        descricao: `⚠️ ${motivo} O pagamento foi encaminhado para estorno total.`,
      },
    }).catch(() => {})
    return { tipo: 'metodo_pagamento_invalido', metodo, esperado, estorno }
  }

  if (order.meioPagamentoCheckout && !pagamentoCompativelComCheckout(
    order.meioPagamentoCheckout,
    payment.payment_method_id,
    payment.payment_type_id,
  )) {
    const metodo = payment.payment_method_id ?? payment.payment_type_id ?? 'não informado'
    const esperado = order.meioPagamentoCheckout
    const motivo =
      `Meio aprovado incompatível com o checkout: recebido ${metodo} ` +
      `(${payment.payment_type_id ?? 'tipo não informado'}), esperado ${esperado}.`
    const estorno = await processarEstornoRegistrado(orderId, paymentId, motivo, deps)
    await prisma.orderTracking.create({
      data: {
        orderId,
        status: 'PAGAMENTO:METODO_NAO_PERMITIDO',
        descricao: `⚠️ ${motivo} O pagamento foi encaminhado para estorno total.`,
      },
    }).catch(() => {})
    return { tipo: 'metodo_pagamento_invalido', metodo, esperado, estorno }
  }

  // ── Aprovado sobre pedido já encerrado: aprovação é dominante ──────────
  if (order.status === 'CANCELADO' || STATUS_JA_RESOLVIDOS.includes(order.status)) {
    return tratarAprovacaoEmPedidoResolvido(
      orderId,
      order.orderNumber,
      order.status,
      paymentId,
      deps,
    )
  }

  // ── Verificação final de estoque ───────────────────────────────────────
  // modo 'confirmacao': a reserva DESTE pedido ainda está de pé, então a
  // pergunta é se o saldo físico cobre as unidades compradas — descontar a
  // própria reserva zeraria a última unidade e cancelaria uma compra paga.
  const itensEstoqueRegular = itensParaVerificarNoTiny(order.items)
  const verificacao = itensEstoqueRegular.length
    ? await (deps.verificarEstoque ?? verificarEstoqueTiny)(itensEstoqueRegular, {
        atualizarBanco: false,
        modo: 'confirmacao',
      } as any).catch(() => ({ ok: true, esgotados: [] })) // falha da API não cancela compra paga
    : { ok: true, esgotados: [] }

  if (!verificacao.ok) {
    const nomes = verificacao.esgotados.map((e) => e.nome).join(', ')
    const motivo = `Produto(s) esgotado(s) no estoque físico após o pagamento: ${nomes}`
    const venceu = await cancelarPedidoPagoComEstorno({
      orderId,
      paymentId,
      motivo,
      descricao:
        `⚠️ Pedido cancelado automaticamente: ${motivo}. Estorno total registrado ` +
        `e reconciliado até confirmação do Mercado Pago. Reservas locais devolvidas.`,
    })
    // Outra entrega do webhook pode ter vencido a transição; quem cancelou conduz.
    if (!venceu) return { tipo: 'ja_processado', status: 'CANCELADO' }

    const linha = await prisma.reembolsoPagamento.findUniqueOrThrow({
      where: { paymentId },
      select: { id: true },
    })
    const estorno = await processarReembolso(linha.id, deps.reembolso)
    return { tipo: 'cancelado_sem_estoque', nomes, estorno }
  }

  // ── Confirma o pedido e baixa a reserva na mesma transação ─────────────
  const confirmou = await prisma.$transaction(async (tx) => {
    const transicao = await tx.order.updateMany({
      where: { id: orderId, status: 'AGUARDANDO_PAGAMENTO' },
      data: {
        status: 'CONFIRMADO',
        pagamentoMetodo: payment.payment_method_id ?? undefined,
        pagamentoIdExterno: preferenceId,
        pagamentoResultadoIncerto: false,
      },
    })
    if (!transicao.count) return false
    await consumirReservaDoPedido(tx, orderId)
    if (order.userId) {
      await tx.customerCRM.upsert({
        where: { userId: order.userId },
        update: {
          totalPedidos: { increment: 1 },
          totalGasto: { increment: Number(order.total) },
          ultimaCompra: new Date(),
          etapaFunil: 'FECHADO',
        },
        create: {
          userId: order.userId,
          totalPedidos: 1,
          totalGasto: Number(order.total),
          ultimaCompra: new Date(),
          etapaFunil: 'FECHADO',
        },
      })
    }
    await tx.orderTracking.create({
      data: {
        orderId,
        status: 'CONFIRMADO',
        descricao: `Pagamento aprovado via ${payment.payment_method_id ?? 'mercadopago'}.`,
      },
    })
    // Caneca avulsa e brinde por compra de pneus são consequências do mesmo
    // fato financeiro. Persistem no mesmo commit da confirmação para que nem
    // queda do processo nem reentrega do webhook deixem o visitante sem o
    // direito que acabou de pagar/conquistar.
    await aplicarBeneficiosPedidoPirelliPago(tx, orderId, {
      formaPagamento: payment.payment_method_id === 'pix' ? 'PIX_MERCADO_PAGO' : 'MERCADO_PAGO',
      referenciaPagamento: payment.id,
    })
    // A confirmação financeira e as obrigações de contato nascem na
    // mesma transação. Chamadas externas acontecem somente após o commit.
    await agendarNotificacoesClientePedido(orderId, tx)
    return true
  })
  if (!confirmou) {
    const estadoAtual = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { status: true, orderNumber: true },
    })
    return tratarAprovacaoEmPedidoResolvido(
      orderId,
      estadoAtual.orderNumber,
      estadoAtual.status,
      paymentId,
      deps,
    )
  }

  return { tipo: 'confirmado', orderId }
}
