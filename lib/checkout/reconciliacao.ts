import { prisma } from '@/lib/prisma'
import { reconciliarPreferencia } from '@/lib/mercadopago'
import { cancelarPedidoComCompensacao } from '@/lib/checkout/reserva'
import {
  buscarPagamentosDoPedido,
  processarReembolsosPendentes,
  type PagamentoResumo,
  type ReembolsoDeps,
} from '@/lib/checkout/pagamento'
import { processarPagamentoPedido } from '@/lib/checkout/webhook-pagamento'
import { efeitosPedidoConfirmado } from '@/lib/checkout/efeitos-pedido-confirmado'
import { pagamentoEmProcessamento } from '@/lib/checkout/prazos-pagamento'

/**
 * Reconciliação do checkout — a peça que faz o resultado incerto CONVERGIR.
 *
 * Três situações chegam aqui:
 *   1. Pedido com `pagamentoResultadoIncerto`: o POST da preferência pode ter
 *      chegado ao MP mesmo com o processo caindo antes da resposta. Busca a
 *      preferência pela external_reference e grava o desfecho.
 *   2. Reserva vencida (`reservaExpiraEm`): devolve estoque e cupom. É isso que
 *      substitui o cancelamento imediato por tentativa rejeitada — sem esta
 *      passada, uma reserva ficaria presa para sempre.
 *   3. Estornos pendentes na outbox.
 *
 * Regra de ouro: NUNCA cancelar sem saber. Se o MP não responde, o pedido é
 * deixado como está e volta na próxima passada.
 */

export interface ReconciliacaoDeps {
  reconciliarPreferencia?: (externalReference: string) => Promise<{ id: string; init_point: string } | null>
  buscarPagamentos?: (orderId: string) => Promise<PagamentoResumo[]>
  processarPagamento?: typeof processarPagamentoPedido
  processarEfeitosPedidoConfirmado?: typeof efeitosPedidoConfirmado
  reembolso?: ReembolsoDeps
  agora?: Date
}

export interface ResumoReconciliacao {
  analisados: number
  reconciliados: number
  confirmados: number
  expirados: number
  indeterminados: number
  notificacoesReparadas: number
  estornos: Awaited<ReturnType<typeof processarReembolsosPendentes>>
}

export async function reconciliarCheckout(
  deps: ReconciliacaoDeps = {},
  opts: { limite?: number; orderIds?: string[] } = {},
): Promise<ResumoReconciliacao> {
  const { limite = 50, orderIds } = opts
  const agora = deps.agora ?? new Date()
  const buscarPagamentos = deps.buscarPagamentos ?? buscarPagamentosDoPedido
  const buscarPreferencia = deps.reconciliarPreferencia ?? reconciliarPreferencia
  const processarPagamento = deps.processarPagamento ?? processarPagamentoPedido
  const processarEfeitos = deps.processarEfeitosPedidoConfirmado ?? efeitosPedidoConfirmado

  const pendentes = await prisma.order.findMany({
    where: {
      status: 'AGUARDANDO_PAGAMENTO',
      // Escopo opcional: permite reconciliar um pedido específico (suporte,
      // testes) sem varrer a fila inteira.
      ...(orderIds ? { id: { in: orderIds } } : {}),
      // A consulta pública com token opaco passa um pedido específico e deve
      // conferir uma aprovação imediatamente, antes da reserva vencer.
      ...(!orderIds ? {
        OR: [
          { pagamentoResultadoIncerto: true },
          { reservaExpiraEm: { lte: agora } },
        ],
      } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limite,
    select: {
      id: true,
      orderNumber: true,
      pagamentoResultadoIncerto: true,
      reservaExpiraEm: true,
    },
  })

  let reconciliados = 0
  let confirmados = 0
  let expirados = 0
  let indeterminados = 0
  let notificacoesReparadas = 0

  for (const pedido of pendentes) {
    let pagamentos: PagamentoResumo[]
    try {
      pagamentos = await buscarPagamentos(pedido.id)
    } catch (e) {
      // Não sabemos o estado do dinheiro: manter a reserva é o lado seguro.
      indeterminados += 1
      console.warn(`[reconciliacao] ${pedido.orderNumber}: consulta de pagamentos falhou —`, e)
      continue
    }

    // Um pagamento aprovado que nunca virou webhook converge aqui. A máquina
    // de estados é a mesma do webhook, então isto é idempotente.
    const aprovado = pagamentos.find((p) => p.status === 'approved')
    if (aprovado) {
      let resultado: Awaited<ReturnType<typeof processarPagamentoPedido>>
      try {
        resultado = await processarPagamento(
          pedido.id,
          aprovado.id,
          aprovado,
          { reembolso: deps.reembolso },
        )
      } catch (e) {
        // Divergência financeira ou falha de dependência nunca pode virar
        // cancelamento silencioso. Mantém a reserva e tenta novamente.
        indeterminados += 1
        console.error(`[reconciliacao] ${pedido.orderNumber}: aprovação não processada —`, e)
        continue
      }

      if (resultado.tipo === 'confirmado' || resultado.tipo === 'ja_processado') {
        confirmados += 1
        // O webhook pode nunca ter chegado. A mesma outbox idempotente usada
        // pela rota completa Olist, e-mail e WhatsApp também neste caminho.
        try {
          await processarEfeitos(pedido.id, aprovado.payment_method_id)
        } catch (e) {
          // A confirmação financeira é definitiva. Uma falha operacional não
          // a desfaz e os marcadores preservam os efeitos já concluídos.
          console.error(`[reconciliacao] ${pedido.orderNumber}: efeitos pós-pagamento pendentes —`, e)
        }
      }
      continue
    }

    const emProcessamento = pagamentos.filter((pagamento) => pagamentoEmProcessamento(pagamento.status))
    if (emProcessamento.length) {
      for (const pagamento of emProcessamento) {
        try {
          await processarPagamento(pedido.id, pagamento.id, pagamento, { reembolso: deps.reembolso })
        } catch (e) {
          indeterminados += 1
          console.error(`[reconciliacao] ${pedido.orderNumber}: pagamento pendente não preservado —`, e)
        }
      }
      // Um pagamento existente ainda pode aprovar. Nunca devolvemos estoque
      // enquanto o próprio Mercado Pago informa processamento ativo.
      continue
    }

    if (pedido.pagamentoResultadoIncerto) {
      let preferencia: { id: string } | null = null
      let consultaOk = true
      try {
        preferencia = await buscarPreferencia(pedido.id)
      } catch (e) {
        consultaOk = false
        console.warn(`[reconciliacao] ${pedido.orderNumber}: consulta de preferência falhou —`, e)
      }
      if (preferencia) {
        await prisma.order.update({
          where: { id: pedido.id },
          data: {
            pagamentoIdExterno: preferencia.id,
            pagamentoMetodo: 'mercadopago',
            pagamentoResultadoIncerto: false,
          },
        })
        await prisma.orderTracking.create({
          data: {
            orderId: pedido.id,
            status: 'AGUARDANDO_PAGAMENTO',
            descricao: `Preferência ${preferencia.id} reconciliada no Mercado Pago. Pedido pronto para pagamento.`,
          },
        }).catch(() => {})
        reconciliados += 1
        continue
      }
      if (!consultaOk) {
        indeterminados += 1
        continue
      }
      // Consulta conclusiva: a preferência não existe. Só encerra depois do
      // prazo — antes disso o próprio cliente ainda pode retomar a tentativa.
    }

    const venceu = pedido.reservaExpiraEm ? pedido.reservaExpiraEm <= agora : false
    if (!venceu) continue

    const cancelado = await cancelarPedidoComCompensacao(
      pedido.id,
      `Reserva expirada sem pagamento aprovado (prazo de ${pedido.reservaExpiraEm?.toISOString()}). ` +
        `Estoque e cupom devolvidos automaticamente.`,
    )
    if (cancelado) expirados += 1
  }

  // Rede de segurança para queda entre versões/deploys: uma compra já paga
  // sem marcador de outbox volta ao mesmo pós-pagamento idempotente.
  const pagosSemOutbox = await prisma.order.findMany({
    where: {
      status: { in: ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE'] },
      notificacoesAgendadasEm: null,
      ...(orderIds ? { id: { in: orderIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    take: limite,
    select: { id: true, pagamentoMetodo: true, orderNumber: true },
  })
  for (const pedido of pagosSemOutbox) {
    try {
      await processarEfeitos(pedido.id, pedido.pagamentoMetodo)
      notificacoesReparadas += 1
    } catch (error) {
      console.error(`[reconciliacao] ${pedido.orderNumber}: reparo de notificações pendente —`, error)
    }
  }

  const estornos = await processarReembolsosPendentes(20, deps.reembolso)

  return {
    analisados: pendentes.length,
    reconciliados,
    confirmados,
    expirados,
    indeterminados,
    notificacoesReparadas,
    estornos,
  }
}
