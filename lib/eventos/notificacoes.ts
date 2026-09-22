import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { enfileirarEmail, processarEmail } from '@/lib/email/queue'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import {
  enfileirarMensagem,
  processarMensagem,
} from '@/lib/evolution/queue'

export type InscricaoEventoNotificavel = {
  id: string
  nome: string
  email: string
  telefone: string
  quantidade: number
  total: unknown
  temGarupa: boolean
  nomeGarupa: string | null
  tipoAcomodacao: string | null
  motoModelo: string | null
  evento: {
    titulo: string
    dataInicio: Date
    local: string
  }
}

export interface NotificacoesEventoAgendadas {
  emailId: string
  whatsappClienteId: string
  whatsappAdminId: string
}

type ClienteOutbox = Pick<Prisma.TransactionClient, 'emailOutbox' | 'crmMensagem'>

function chaves(inscricaoId: string) {
  return {
    email: `evento:${inscricaoId}:email:confirmado`,
    whatsappCliente: `evento:${inscricaoId}:whatsapp:confirmado`,
    whatsappAdmin: `evento:${inscricaoId}:whatsapp:admin:confirmado`,
  }
}

/**
 * Cria as três obrigações duráveis dentro do mesmo commit da confirmação.
 * Não faz I/O externo; a entrega imediata acontece somente depois do commit.
 */
export async function agendarNotificacoesAprovacaoEvento(
  inscricao: InscricaoEventoNotificavel,
  db: ClienteOutbox,
): Promise<NotificacoesEventoAgendadas | null> {
  if (process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS === 'false') return null

  const ids = chaves(inscricao.id)
  const totalNumero = Number(inscricao.total)
  const totalFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(totalNumero)
  const dataEvento = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' })
    .format(inscricao.evento.dataInicio)

  const email = await enfileirarEmail({
    chaveIdempotencia: ids.email,
    tipo: 'INGRESSO_CONFIRMADO',
    destinatario: inscricao.email,
    payload: {
      nomeCliente: inscricao.nome,
      tituloEvento: inscricao.evento.titulo,
      dataEvento,
      localEvento: inscricao.evento.local,
      quantidade: inscricao.quantidade,
      total: totalNumero,
    },
  }, db)

  const whatsappCliente = await enfileirarMensagem({
    chaveIdempotencia: ids.whatsappCliente,
    whatsapp: normalizarWhatsApp(inscricao.telefone),
    nome: inscricao.nome,
    tipo: 'INGRESSO_CONFIRMADO',
    payload: {
      tituloEvento: inscricao.evento.titulo,
      quantidade: inscricao.quantidade,
      total: totalFmt,
    },
  }, db)

  const garupa = inscricao.temGarupa
    ? `Sim (${inscricao.nomeGarupa || 'nome não informado'})`
    : 'Não (solo)'
  const whatsappAdmin = await enfileirarMensagem({
    chaveIdempotencia: ids.whatsappAdmin,
    whatsapp: process.env.ADMIN_WHATSAPP ?? '5519974049445',
    nome: 'Admin',
    tipo: 'MANUAL',
    payload: {
      conteudo:
        `🎟️ *NOVO INGRESSO CONFIRMADO — Forza Motos*\n\n` +
        `🏁 Evento: ${inscricao.evento.titulo}\n` +
        `👤 Nome: ${inscricao.nome}\n` +
        `📧 E-mail: ${inscricao.email}\n` +
        `📱 Tel: ${inscricao.telefone}\n` +
        `🏍️ Moto: ${inscricao.motoModelo || 'Não informada'}\n` +
        `👥 Garupa: ${garupa}\n` +
        `🛏️ Quarto: ${inscricao.tipoAcomodacao || 'Não se aplica'}\n` +
        `🎟️ Vagas: ${inscricao.quantidade}\n` +
        `💰 Total: ${totalFmt}`,
    },
  }, db)

  return {
    emailId: email.id,
    whatsappClienteId: whatsappCliente.id,
    whatsappAdminId: whatsappAdmin.id,
  }
}

/** Primeiro tenta o cliente; qualquer falha permanece nas filas para o cron. */
export async function processarNotificacoesAprovacaoEvento(
  agendadas: NotificacoesEventoAgendadas | null,
) {
  if (!agendadas) return
  const tentativas = [
    ['e-mail do participante', () => processarEmail(agendadas.emailId)],
    ['WhatsApp do participante', () => processarMensagem(agendadas.whatsappClienteId)],
    ['WhatsApp administrativo', () => processarMensagem(agendadas.whatsappAdminId)],
  ] as const

  const drenagem = Promise.all(tentativas.map(async ([canal, processar]) => {
    try {
      const resultado = await processar()
      if (!resultado.enviada) {
        console.warn(`[eventos/notificacoes] ${canal} permaneceu ${resultado.status}; cron tentará novamente.`)
      }
    } catch (error) {
      console.error(`[eventos/notificacoes] Falha ao processar ${canal}:`, error)
    }
  }))

  // O cliente não pode ficar preso no redirect se um provedor estiver lento.
  // As promises continuam e, se não concluírem, as leases expiram para o cron.
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      drenagem,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          console.warn('[eventos/notificacoes] Drain imediato excedeu 6s; cron continuará a entrega.')
          resolve()
        }, 6_000)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Compatibilidade para webhook/reconciliação: UPSERT idempotente e drain
 * imediato. A obrigação principal já nasceu no commit financeiro.
 */
export async function notificarAprovacaoEvento(inscricao: InscricaoEventoNotificavel) {
  if (process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS === 'false') return
  const agendadas = await prisma.$transaction((tx) =>
    agendarNotificacoesAprovacaoEvento(inscricao, tx),
  )
  await processarNotificacoesAprovacaoEvento(agendadas)
}
