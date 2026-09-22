import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { solicitarReembolsoMP } from '@/lib/checkout/pagamento'
import {
  consultarPagamentoMP,
  validarRecebedorPagamentoMP,
  type PagamentoMPNormalizado,
} from '@/lib/checkout/mercadopago-webhook'
import {
  EventoCheckoutError,
  type PagamentoMercadoPagoEvento,
  validarPagamentoEvento,
} from '@/lib/eventos/checkout'
import { travarCapacidadeEvento } from '@/lib/eventos/lock'
import { vincularPagamentoEvento } from '@/lib/eventos/vinculo-pagamento'
import { agendarNotificacoesAprovacaoEvento } from '@/lib/eventos/notificacoes'
import {
  calcularExpiracaoCompensacao,
  maiorPrazo,
  pagamentoEmProcessamento,
} from '@/lib/checkout/prazos-pagamento'

const EXTERNAL_REFERENCE_EVENTO = /^evento_([A-Za-z0-9_-]{8,100})$/
const MAX_TENTATIVAS_REEMBOLSO = 8
const BACKOFF_BASE_MS = 5 * 60 * 1000
const BACKOFF_TETO_MS = 6 * 60 * 60 * 1000

export type ResultadoPagamentoEvento =
  | { tipo: 'evento_desconhecido' }
  | {
      tipo: 'evento_processado'
      status: string
      tentativaNova: boolean
      statusPagamentoAlterado: boolean
      notificarAprovacao: boolean
      reembolsoAgendado: boolean
      inscricao: Prisma.EventoInscricaoGetPayload<{ include: { evento: true } }>
    }

function paraPagamentoEvento(payment: PagamentoMPNormalizado): PagamentoMercadoPagoEvento {
  return {
    id: payment.id,
    status: payment.status,
    status_detail: payment.status_detail,
    external_reference: payment.external_reference ?? '',
    transaction_amount: payment.transaction_amount,
    currency_id: payment.currency_id,
    preference_id: payment.preference_id,
    collector_id: payment.collector_id,
    payment_method_id: payment.payment_method_id,
  }
}

/**
 * Máquina de estados financeira de eventos, compartilhada pelo webhook e pela
 * reconciliação. Valor, moeda, referência e preferência são validados antes de
 * qualquer gravação. Efeitos de comunicação ficam no chamador e só rodam
 * quando `notificarAprovacao` é true.
 */
export async function processarPagamentoEvento(
  payment: PagamentoMPNormalizado,
  agora = new Date(),
): Promise<ResultadoPagamentoEvento> {
  const match = payment.external_reference?.match(EXTERNAL_REFERENCE_EVENTO)
  if (!match) return { tipo: 'evento_desconhecido' }
  await validarRecebedorPagamentoMP(payment)
  const inscricaoId = match[1]

  // O MP pode omitir preference_id e negar a leitura da merchant order. A
  // consulta oficial da preferência ocorre antes da transação/lock; dentro da
  // transação revalidamos o snapshot resolvido contra o estado atual.
  const referencia = await prisma.eventoInscricao.findUnique({
    where: { id: inscricaoId },
    select: { id: true, eventoId: true, total: true, mpPreferenciaId: true },
  })
  if (!referencia) return { tipo: 'evento_desconhecido' }
  const pagamentoVinculado = await vincularPagamentoEvento(referencia, payment)

  return prisma.$transaction(
    async (tx) => {
      // É o mesmo lock usado pela criação/expiração de reservas. Aprovação e
      // liberação da última vaga não podem vencer ao mesmo tempo.
      await travarCapacidadeEvento(tx, referencia.eventoId)

      const inscricao = await tx.eventoInscricao.findUnique({
        where: { id: inscricaoId },
        include: { evento: true },
      })
      if (!inscricao) return { tipo: 'evento_desconhecido' } as const

      const decisao = validarPagamentoEvento(inscricao, paraPagamentoEvento(pagamentoVinculado), agora)
      const reservaCompensacao = pagamentoEmProcessamento(payment.status)
        ? maiorPrazo(inscricao.reservaExpiraEm, calcularExpiracaoCompensacao(agora))
        : null
      const tentativaExistente = await tx.eventoPagamentoTentativa.findUnique({
        where: { paymentId: payment.id },
      })
      if (tentativaExistente && tentativaExistente.inscricaoId !== inscricao.id) {
        throw new EventoCheckoutError(
          'Pagamento associado a outra inscrição.',
          422,
          'pagamento_associado_a_outra_inscricao',
        )
      }

      if (tentativaExistente) {
        await tx.eventoPagamentoTentativa.update({
          where: { paymentId: payment.id },
          data: {
            status: payment.status,
            metodo: payment.payment_method_id ?? undefined,
            valor: payment.transaction_amount ?? undefined,
          },
        })
      } else {
        await tx.eventoPagamentoTentativa.create({
          data: {
            inscricaoId: inscricao.id,
            paymentId: payment.id,
            status: payment.status,
            metodo: payment.payment_method_id,
            valor: payment.transaction_amount,
          },
        })
      }

      let reembolsoAgendado = false
      if (decisao.reembolsoNecessario) {
        const motivo = inscricao.mpPagamentoId && inscricao.mpPagamentoId !== payment.id
          ? `Pagamento duplicado para a preferência ${inscricao.mpPreferenciaId}.`
          : 'Pagamento aprovado depois da expiração/cancelamento da reserva do evento.'
        await tx.eventoReembolsoPagamento.upsert({
          where: { paymentId: payment.id },
          create: {
            inscricaoId: inscricao.id,
            paymentId: payment.id,
            motivo,
            proximaTentativaEm: agora,
          },
          update: {},
        })
        reembolsoAgendado = true
      }

      if (decisao.alterou || decisao.reembolsoNecessario || reservaCompensacao) {
        await tx.eventoInscricao.update({
          where: { id: inscricao.id },
          data: {
            status: decisao.statusInscricao,
            mpStatus: decisao.reembolsoNecessario ? 'refund_pending' : payment.status,
            pagamentoResultadoIncerto: false,
            ...(decisao.statusInscricao === 'PAGO' && !decisao.reembolsoNecessario
              ? { mpPagamentoId: payment.id, reservaExpiraEm: null }
              : {}),
            ...(decisao.statusInscricao === 'PENDENTE' && reservaCompensacao
              ? { reservaExpiraEm: reservaCompensacao }
              : {}),
            ...(decisao.statusInscricao === 'CANCELADO' ? { reservaExpiraEm: null } : {}),
          },
        })
      } else if (inscricao.pagamentoResultadoIncerto) {
        await tx.eventoInscricao.update({
          where: { id: inscricao.id },
          data: { pagamentoResultadoIncerto: false },
        })
      }

      if (payment.status === 'refunded') {
        await tx.eventoReembolsoPagamento.updateMany({
          where: { paymentId: payment.id, status: 'PENDENTE' },
          data: {
            status: 'CONCLUIDO',
            concluidoEm: agora,
            ultimoErro: null,
            proximaTentativaEm: null,
          },
        })
      }

      const atualizada = await tx.eventoInscricao.findUniqueOrThrow({
        where: { id: inscricao.id },
        include: { evento: true },
      })
      if (decisao.notificarAprovacao) {
        // A obrigação de comunicar nasce no mesmo commit do status PAGO. O
        // webhook/reconciliador só faz o drain externo depois do commit.
        await agendarNotificacoesAprovacaoEvento(atualizada, tx)
      }
      return {
        tipo: 'evento_processado',
        status: payment.status,
        tentativaNova: !tentativaExistente,
        statusPagamentoAlterado: !tentativaExistente || tentativaExistente.status !== payment.status,
        notificarAprovacao: decisao.notificarAprovacao,
        reembolsoAgendado,
        inscricao: atualizada,
      } as const
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  )
}

function proximoBackoff(tentativas: number, agora: Date): Date {
  const espera = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, tentativas - 1), BACKOFF_TETO_MS)
  return new Date(agora.getTime() + espera)
}

/** Processa a outbox de estornos de evento; seguro para cron e retries. */
export async function processarReembolsosEventoPendentes(limite = 20, agora = new Date()) {
  const pendentes = await prisma.eventoReembolsoPagamento.findMany({
    where: {
      status: 'PENDENTE',
      OR: [{ proximaTentativaEm: null }, { proximaTentativaEm: { lte: agora } }],
    },
    orderBy: { createdAt: 'asc' },
    take: limite,
  })
  const resumo = { analisados: pendentes.length, concluidos: 0, pendentes: 0, falhos: 0 }

  for (const reembolso of pendentes) {
    const tentativas = reembolso.tentativas + 1
    let resultado: Awaited<ReturnType<typeof solicitarReembolsoMP>>
    try {
      resultado = await solicitarReembolsoMP(reembolso.paymentId)
    } catch (error) {
      resultado = { ok: false, status: 0, corpo: String(error).slice(0, 500) }
    }

    if (resultado.ok) {
      try {
        // Um HTTP 2xx confirma que o pedido de estorno foi aceito, mas a vaga
        // só pode ser liberada quando o próprio pagamento já estiver
        // oficialmente `refunded`. Assim, a convergência não depende de um
        // segundo webhook do Mercado Pago.
        const pagamento = await consultarPagamentoMP(reembolso.paymentId)
        if (pagamento?.status === 'refunded') {
          const processado = await processarPagamentoEvento(pagamento, agora)
          if (processado.tipo !== 'evento_processado') {
            throw new Error('Pagamento reembolsado não corresponde a uma inscrição de evento.')
          }
          await prisma.eventoReembolsoPagamento.updateMany({
            where: { id: reembolso.id, status: 'CONCLUIDO' },
            data: { tentativas },
          })
          resumo.concluidos += 1
          continue
        }
        resultado = {
          ok: false,
          status: 202,
          corpo: `Estorno aceito; pagamento ainda está ${pagamento?.status ?? 'indisponível'}.`,
        }
      } catch (error) {
        resultado = {
          ok: false,
          status: 503,
          corpo: `Estorno aceito, mas a confirmação falhou: ${String(error)}`.slice(0, 500),
        }
      }
    }

    const falhou = tentativas >= MAX_TENTATIVAS_REEMBOLSO
    await prisma.eventoReembolsoPagamento.updateMany({
      where: { id: reembolso.id, status: 'PENDENTE' },
      data: {
        status: falhou ? 'FALHOU' : 'PENDENTE',
        tentativas,
        ultimoErro: `HTTP ${resultado.status}: ${resultado.corpo}`.slice(0, 500),
        proximaTentativaEm: falhou ? null : proximoBackoff(tentativas, agora),
      },
    })
    if (falhou) {
      resumo.falhos += 1
      console.error(`[eventos/reembolso] Estorno ${reembolso.id} esgotou ${tentativas} tentativas.`)
    } else {
      resumo.pendentes += 1
    }
  }

  return resumo
}
