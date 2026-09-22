import { prisma } from '@/lib/prisma'
import { reconciliarPreferencia } from '@/lib/mercadopago'
import { buscarPagamentosDoPedido } from '@/lib/checkout/pagamento'
import {
  processarPagamentoEvento,
  processarReembolsosEventoPendentes,
} from '@/lib/eventos/pagamento'
import { notificarAprovacaoEvento } from '@/lib/eventos/notificacoes'
import { travarCapacidadeEvento } from '@/lib/eventos/lock'
import { pagamentoEmProcessamento } from '@/lib/checkout/prazos-pagamento'

export interface ResumoReconciliacaoEventos {
  analisados: number
  preferenciasRecuperadas: number
  pagamentosProcessados: number
  expirados: number
  indeterminados: number
  reembolsos: Awaited<ReturnType<typeof processarReembolsosEventoPendentes>>
}

/**
 * Converge preferências cujo POST teve resultado ambíguo, aprova pagamentos
 * cujo webhook não chegou e só libera vagas vencidas depois de uma consulta
 * conclusiva ao Mercado Pago.
 */
export async function reconciliarPagamentosEventos(
  opts: {
    limite?: number
    agora?: Date
    inscricaoIds?: string[]
    /** Consulta também reservas ativas; usado no retorno autenticado pelo token opaco. */
    forcarConsulta?: boolean
  } = {},
): Promise<ResumoReconciliacaoEventos> {
  const limite = opts.limite ?? 50
  const agora = opts.agora ?? new Date()
  const pendentes = await prisma.eventoInscricao.findMany({
    where: {
      status: 'PENDENTE',
      ...(opts.inscricaoIds ? { id: { in: opts.inscricaoIds } } : {}),
      ...(!opts.forcarConsulta ? {
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
      eventoId: true,
      mpPreferenciaId: true,
      pagamentoResultadoIncerto: true,
      reservaExpiraEm: true,
    },
  })

  let preferenciasRecuperadas = 0
  let pagamentosProcessados = 0
  let expirados = 0
  let indeterminados = 0

  for (const inscricao of pendentes) {
    const externalReference = `evento_${inscricao.id}`
    if (inscricao.pagamentoResultadoIncerto || !inscricao.mpPreferenciaId) {
      let preferencia: Awaited<ReturnType<typeof reconciliarPreferencia>> = null
      try {
        preferencia = await reconciliarPreferencia(externalReference)
      } catch (error) {
        indeterminados += 1
        console.warn(`[eventos/reconciliacao] ${inscricao.id}: consulta de preferência falhou`, error)
        continue
      }

      if (preferencia) {
        await prisma.eventoInscricao.updateMany({
          where: { id: inscricao.id, status: 'PENDENTE' },
          data: {
            mpPreferenciaId: preferencia.id,
            mpStatus: 'pending',
            pagamentoResultadoIncerto: false,
          },
        })
        inscricao.mpPreferenciaId = preferencia.id
        inscricao.pagamentoResultadoIncerto = false
        preferenciasRecuperadas += 1
      }
    }

    let pagamentos: Awaited<ReturnType<typeof buscarPagamentosDoPedido>>
    try {
      pagamentos = await buscarPagamentosDoPedido(externalReference)
    } catch (error) {
      indeterminados += 1
      console.warn(`[eventos/reconciliacao] ${inscricao.id}: consulta de pagamentos falhou`, error)
      continue
    }

    const aprovados = pagamentos.filter((pagamento) => pagamento.status === 'approved')
    if (aprovados.length) {
      let processou = false
      for (const aprovado of aprovados) {
        try {
          const resultado = await processarPagamentoEvento(aprovado, agora)
          if (resultado.tipo === 'evento_processado') {
            pagamentosProcessados += 1
            processou = true
            if (resultado.notificarAprovacao) {
              await notificarAprovacaoEvento(resultado.inscricao)
            }
          }
        } catch (error) {
          indeterminados += 1
          console.error(`[eventos/reconciliacao] ${inscricao.id}: aprovação não processada`, error)
        }
      }
      if (processou) continue
      // Há dinheiro aprovado, mas ele não passou nas validações. Nunca liberar
      // a reserva/cancelar silenciosamente; a próxima rodada tenta de novo e o
      // erro permanece visível para intervenção.
      continue
    }

    const emProcessamento = pagamentos.filter((pagamento) => pagamentoEmProcessamento(pagamento.status))
    if (emProcessamento.length) {
      for (const pagamento of emProcessamento) {
        try {
          const resultado = await processarPagamentoEvento(pagamento, agora)
          if (resultado.tipo === 'evento_processado') pagamentosProcessados += 1
        } catch (error) {
          indeterminados += 1
          console.error(`[eventos/reconciliacao] ${inscricao.id}: pagamento pendente não preservado`, error)
        }
      }
      // Há dinheiro em processamento. Mesmo se a persistência transitória
      // falhar, nunca liberamos a vaga sem uma consulta conclusiva posterior.
      continue
    }

    if (!inscricao.reservaExpiraEm || inscricao.reservaExpiraEm > agora) continue

    const cancelada = await prisma.$transaction(async (tx) => {
      await travarCapacidadeEvento(tx, inscricao.eventoId)
      return tx.eventoInscricao.updateMany({
        where: {
          id: inscricao.id,
          status: 'PENDENTE',
          reservaExpiraEm: { lte: agora },
        },
        data: {
          status: 'CANCELADO',
          mpStatus: 'expired',
          pagamentoResultadoIncerto: false,
          reservaExpiraEm: null,
        },
      })
    })
    expirados += cancelada.count
  }

  const reembolsos = await processarReembolsosEventoPendentes(20, agora)
  return {
    analisados: pendentes.length,
    preferenciasRecuperadas,
    pagamentosProcessados,
    expirados,
    indeterminados,
    reembolsos,
  }
}
