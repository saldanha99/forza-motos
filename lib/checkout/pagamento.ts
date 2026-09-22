import { prisma } from '@/lib/prisma'
import { cancelarPedidoComCompensacaoTx } from '@/lib/checkout/reserva'
import {
  consultarPagamentoMP,
  normalizarPagamentoMP,
  type PagamentoMPNormalizado,
} from '@/lib/checkout/mercadopago-webhook'
import { chaveIdempotenciaMP } from '@/lib/mercadopago'
import { reverterBeneficiosPedidoPirelliCancelado } from '@/lib/checkout/beneficios-evento-pirelli'
import { bloquearVisitanteEvento } from '@/lib/evento-pirelli'

/**
 * Tentativas de pagamento e estorno durável.
 *
 * Duas regras sustentam este módulo:
 *
 *  1. Uma preferência do Mercado Pago aceita VÁRIAS tentativas — o comprador
 *     tem cartão recusado e tenta Pix na mesma tela. Por isso uma rejeição
 *     NUNCA encerra o pedido: ela vira histórico e a reserva segue de pé até
 *     `Order.reservaExpiraEm`. Quem encerra é a aprovação ou a expiração.
 *  2. Nenhum cancelamento de pedido pago acontece sem uma linha durável de
 *     estorno. O POST /refunds tem o HTTP validado; enquanto não for
 *     conclusivo, a linha fica PENDENTE e a reconciliação insiste.
 */

const MAX_TENTATIVAS_REEMBOLSO = 8
const BACKOFF_BASE_MS = 5 * 60 * 1000
const BACKOFF_TETO_MS = 6 * 60 * 60 * 1000

export interface ResultadoChamadaMP {
  ok: boolean
  status: number
  corpo: string
}

export interface ReembolsoDeps {
  /** Injetável nos testes; a implementação real fala com o Mercado Pago. */
  solicitarReembolso?: (paymentId: string) => Promise<ResultadoChamadaMP>
  alertarAdmin?: (mensagem: string) => Promise<void>
}

export async function solicitarReembolsoMP(paymentId: string): Promise<ResultadoChamadaMP> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) return { ok: false, status: 0, corpo: 'MERCADOPAGO_ACCESS_TOKEN não configurado' }
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      // Evita estornos duplicados se esta chamada for repetida pela fila.
      'X-Idempotency-Key': chaveIdempotenciaMP(`refund:${paymentId}`),
    },
    body: JSON.stringify({}), // corpo vazio = reembolso total
  })
  const corpo = await res.text().catch(() => '')
  if (res.ok) return { ok: true, status: res.status, corpo: corpo.slice(0, 500) }

  // A resposta do POST pode se perder depois de o estorno ter sido efetivado.
  // Confere o pagamento antes de classificar um retry idempotente como falha.
  try {
    const pagamento = await consultarPagamentoMP(paymentId)
    if (pagamento?.status === 'refunded') {
      return { ok: true, status: res.status, corpo: 'Pagamento já constava como refunded.' }
    }
  } catch {
    // A fila guarda o erro original e tenta novamente; não mascara incerteza.
  }
  return { ok: false, status: res.status, corpo: corpo.slice(0, 500) }
}

export type PagamentoResumo = PagamentoMPNormalizado

/**
 * Todos os pagamentos que o MP conhece para um pedido. Lança em qualquer
 * resposta não conclusiva: quem reconcilia precisa distinguir "não há
 * pagamento" de "não consegui saber" — só o primeiro autoriza cancelar.
 */
export async function buscarPagamentosDoPedido(orderId: string): Promise<PagamentoResumo[]> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
  const query = new URLSearchParams({ external_reference: orderId, limit: '30' })
  const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Busca de pagamentos retornou HTTP ${res.status}`)
  const data = await res.json()
  const lista = Array.isArray(data?.results) ? data.results : []
  const resultados: PagamentoResumo[] = []
  for (const item of lista.filter((p: any) => p?.id && p?.status)) {
    // Uma aprovação encontrada pela reconciliação passa pelas mesmas
    // validações do webhook; por isso hidratamos a representação oficial.
    if (item.status === 'approved') {
      const completo = await consultarPagamentoMP(String(item.id))
      if (!completo) throw new Error(`Pagamento aprovado ${item.id} não encontrado ao hidratar`)
      resultados.push(completo)
    } else {
      resultados.push(await normalizarPagamentoMP(item, { resolverPreferencia: false }))
    }
  }
  return resultados
}

async function alertarAdminPadrao(mensagem: string): Promise<void> {
  const { enfileirarMensagem } = await import('@/lib/evolution/queue')
  const adminPhone = process.env.ADMIN_WHATSAPP ?? '5519974049445'
  await enfileirarMensagem({
    whatsapp: adminPhone,
    nome: 'Admin',
    tipo: 'MANUAL',
    payload: { conteudo: mensagem },
  })
}

/** Registra/atualiza a tentativa. `novo` diz se é a primeira vez que a vemos. */
export async function registrarTentativaPagamento(input: {
  orderId: string
  paymentId: string
  status: string
  metodo?: string | null
  valor?: number | null
}): Promise<{ novo: boolean }> {
  const existente = await prisma.pagamentoTentativa.findUnique({
    where: { paymentId: input.paymentId },
    select: { id: true, orderId: true, status: true },
  })
  if (existente) {
    if (existente.orderId !== input.orderId) {
      throw new Error('PAGAMENTO_ASSOCIADO_A_OUTRO_PEDIDO')
    }
    if (existente.status !== input.status) {
      await prisma.pagamentoTentativa.update({
        where: { paymentId: input.paymentId },
        data: {
          status: input.status,
          metodo: input.metodo ?? undefined,
          valor: input.valor ?? undefined,
        },
      })
    }
    return { novo: false }
  }
  try {
    await prisma.pagamentoTentativa.create({
      data: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        status: input.status,
        metodo: input.metodo ?? undefined,
        valor: input.valor ?? undefined,
      },
    })
    return { novo: true }
  } catch (error: any) {
    // Corrida com outra entrega do mesmo webhook: a unique em paymentId venceu.
    if (error?.code === 'P2002') {
      const vencedor = await prisma.pagamentoTentativa.findUnique({
        where: { paymentId: input.paymentId },
        select: { orderId: true },
      })
      if (vencedor?.orderId !== input.orderId) {
        throw new Error('PAGAMENTO_ASSOCIADO_A_OUTRO_PEDIDO')
      }
      return { novo: false }
    }
    throw error
  }
}

/** Cria a linha de estorno; idempotente por paymentId. */
export async function agendarReembolso(input: {
  orderId: string
  paymentId: string
  motivo: string
}): Promise<void> {
  await prisma.reembolsoPagamento.upsert({
    where: { paymentId: input.paymentId },
    create: {
      orderId: input.orderId,
      paymentId: input.paymentId,
      motivo: input.motivo,
      proximaTentativaEm: new Date(),
    },
    update: {},
  })
}

/**
 * Cancela um pedido pago e registra o estorno na MESMA transação: é
 * impossível existir um cancelamento por falta de estoque sem a obrigação
 * durável de devolver o dinheiro.
 *
 * @returns true quando este processo venceu o cancelamento (e portanto deve
 *   conduzir o estorno); false quando outra entrega do webhook já venceu.
 */
export async function cancelarPedidoPagoComEstorno(input: {
  orderId: string
  paymentId: string
  descricao: string
  motivo: string
}): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const cancelado = await cancelarPedidoComCompensacaoTx(tx, input.orderId, input.descricao)
    if (!cancelado) return false
    await tx.reembolsoPagamento.upsert({
      where: { paymentId: input.paymentId },
      create: {
        orderId: input.orderId,
        paymentId: input.paymentId,
        motivo: input.motivo,
        proximaTentativaEm: new Date(),
      },
      update: {},
    })
    return true
  })
}

export type ResultadoCancelamentoPagoAdmin =
  | { ok: true; paymentId: string; reembolsoId: string }
  | { ok: false; motivo: 'ESTADO_INVALIDO' | 'PAGAMENTO_APROVADO_NAO_ENCONTRADO' | 'CORRIDA' }

/**
 * Cancelamento administrativo de pedido já pago. A mudança de status, a
 * devolução do uso do cupom e a obrigação de estorno nascem juntas. Estoque
 * físico não é somado aqui: o Olist pode já ter baixado/movimentado a venda.
 */
export async function cancelarPedidoPagoAdministrativamente(
  orderId: string,
  descricao: string,
): Promise<ResultadoCancelamentoPagoAdmin> {
  return prisma.$transaction(async (tx) => {
    const pedido = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        eventoPirelliVisitanteId: true,
        cupomCodigo: true,
        cupomConsumido: true,
        PagamentoTentativa: {
          where: { status: 'approved' },
          orderBy: { updatedAt: 'desc' },
          take: 1,
          select: { paymentId: true },
        },
      },
    })
    if (!pedido || !['CONFIRMADO', 'SEPARANDO'].includes(pedido.status)) {
      return { ok: false, motivo: 'ESTADO_INVALIDO' } as const
    }
    const paymentId = pedido.PagamentoTentativa[0]?.paymentId
    if (!paymentId) return { ok: false, motivo: 'PAGAMENTO_APROVADO_NAO_ENCONTRADO' } as const

    if (pedido.eventoPirelliVisitanteId) {
      await bloquearVisitanteEvento(tx, pedido.eventoPirelliVisitanteId)
    }

    const mudou = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['CONFIRMADO', 'SEPARANDO'] } },
      data: {
        status: 'CANCELADO',
        cupomConsumido: false,
        pagamentoResultadoIncerto: false,
      },
    })
    if (!mudou.count) return { ok: false, motivo: 'CORRIDA' } as const

    await reverterBeneficiosPedidoPirelliCancelado(tx, orderId, {
      por: 'Painel administrativo',
      motivo: descricao,
    })

    if (pedido.cupomConsumido && pedido.cupomCodigo) {
      await tx.cupom.updateMany({
        where: { codigo: pedido.cupomCodigo, usados: { gt: 0 } },
        data: { usados: { decrement: 1 } },
      })
    }

    const reembolso = await tx.reembolsoPagamento.upsert({
      where: { paymentId },
      create: {
        orderId,
        paymentId,
        motivo: 'Pedido pago cancelado no painel administrativo.',
        proximaTentativaEm: new Date(),
      },
      update: {},
      select: { id: true },
    })
    await tx.orderTracking.create({
      data: {
        orderId,
        status: 'CANCELADO',
        descricao: `${descricao} Estorno total ${paymentId} registrado para processamento durável.`,
      },
    })
    return { ok: true, paymentId, reembolsoId: reembolso.id } as const
  })
}

function proximoBackoff(tentativas: number): Date {
  const espera = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, tentativas - 1), BACKOFF_TETO_MS)
  return new Date(Date.now() + espera)
}

/**
 * Executa UMA linha de estorno e persiste o desfecho. O HTTP é validado: um
 * 401/500 não passa por "reembolso solicitado" — permanece PENDENTE com o erro
 * gravado até um resultado conclusivo, e vira FALHOU (com alerta) no teto.
 */
export async function processarReembolso(
  reembolsoId: string,
  deps: ReembolsoDeps = {},
): Promise<'CONCLUIDO' | 'PENDENTE' | 'FALHOU' | 'IGNORADO'> {
  const reembolso = await prisma.reembolsoPagamento.findUnique({ where: { id: reembolsoId } })
  if (!reembolso || reembolso.status !== 'PENDENTE') return 'IGNORADO'

  const chamar = deps.solicitarReembolso ?? solicitarReembolsoMP
  const alertar = deps.alertarAdmin ?? alertarAdminPadrao
  const tentativas = reembolso.tentativas + 1

  let resultado: ResultadoChamadaMP
  try {
    resultado = await chamar(reembolso.paymentId)
  } catch (error) {
    resultado = { ok: false, status: 0, corpo: String(error).slice(0, 500) }
  }

  if (resultado.ok) {
    await prisma.reembolsoPagamento.update({
      where: { id: reembolso.id },
      data: {
        status: 'CONCLUIDO',
        tentativas,
        concluidoEm: new Date(),
        ultimoErro: null,
        proximaTentativaEm: null,
      },
    })
    await prisma.orderTracking.create({
      data: {
        orderId: reembolso.orderId,
        status: 'REEMBOLSO:CONCLUIDO',
        descricao: `Estorno total confirmado pelo Mercado Pago (pagamento ${reembolso.paymentId}).`,
      },
    }).catch(() => {})
    return 'CONCLUIDO'
  }

  const esgotou = tentativas >= MAX_TENTATIVAS_REEMBOLSO
  const erro = `HTTP ${resultado.status}: ${resultado.corpo}`.slice(0, 500)
  await prisma.reembolsoPagamento.update({
    where: { id: reembolso.id },
    data: {
      status: esgotou ? 'FALHOU' : 'PENDENTE',
      tentativas,
      ultimoErro: erro,
      proximaTentativaEm: esgotou ? null : proximoBackoff(tentativas),
    },
  })
  await prisma.orderTracking.create({
    data: {
      orderId: reembolso.orderId,
      status: esgotou ? 'REEMBOLSO:FALHOU' : 'REEMBOLSO:PENDENTE',
      descricao: `Tentativa ${tentativas} de estorno do pagamento ${reembolso.paymentId} não confirmada — ${erro}`,
    },
  }).catch(() => {})

  if (esgotou) {
    await alertar(
      `🚨 *ESTORNO NÃO CONFIRMADO — Forza Motos*\n\n` +
        `Pagamento: ${reembolso.paymentId}\n` +
        `Pedido: ${reembolso.orderId}\n` +
        `Motivo: ${reembolso.motivo}\n` +
        `Último erro: ${erro}\n\n` +
        `👉 Estornar MANUALMENTE no painel do Mercado Pago.`,
    ).catch(() => {})
  }
  return esgotou ? 'FALHOU' : 'PENDENTE'
}

/** Varre a fila de estornos vencidos. Usada pela rota de reconciliação. */
export async function processarReembolsosPendentes(
  limite = 20,
  deps: ReembolsoDeps = {},
): Promise<{ processados: number; concluidos: number; pendentes: number; falhados: number }> {
  const agora = new Date()
  const fila = await prisma.reembolsoPagamento.findMany({
    where: {
      status: 'PENDENTE',
      OR: [{ proximaTentativaEm: null }, { proximaTentativaEm: { lte: agora } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limite,
    select: { id: true },
  })
  let concluidos = 0
  let pendentes = 0
  let falhados = 0
  for (const item of fila) {
    const desfecho = await processarReembolso(item.id, deps)
    if (desfecho === 'CONCLUIDO') concluidos += 1
    else if (desfecho === 'FALHOU') falhados += 1
    else if (desfecho === 'PENDENTE') pendentes += 1
  }
  return { processados: fila.length, concluidos, pendentes, falhados }
}
