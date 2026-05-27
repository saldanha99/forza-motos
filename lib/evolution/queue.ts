/**
 * Fila de mensagens WhatsApp
 *
 * Enfileirar: adiciona à tabela CrmMensagem com status PENDENTE
 * Processar:  cron a cada 5 min chama processarFila() que envia via Evolution API
 */

import { prisma } from '@/lib/prisma'
import { enviarMensagem } from './client'
import {
  msgBoasVindas,
  msgAgendamento,
  msgPedidoConfirmado,
  msgPedidoEnviado,
  msgCarrinhoAbandonado,
  msgPosVenda,
  msgReativacao,
} from './templates'

type MensagemTipo =
  | 'BOAS_VINDAS'
  | 'AGENDAMENTO'
  | 'PEDIDO_CONFIRMADO'
  | 'PEDIDO_ENVIADO'
  | 'CARRINHO_ABANDONADO'
  | 'POS_VENDA'
  | 'REATIVACAO'
  | 'MANUAL'

interface EnfileirarParams {
  whatsapp: string
  nome: string
  tipo: MensagemTipo
  leadId?: string
  userId?: string
  payload?: Record<string, unknown>
  agendadoPara?: Date // default: agora
}

/** Gera o texto da mensagem a partir do tipo e payload */
function gerarConteudo(tipo: MensagemTipo, nome: string, payload: Record<string, unknown>): string {
  switch (tipo) {
    case 'BOAS_VINDAS':
      return msgBoasVindas(nome)
    case 'AGENDAMENTO':
      return msgAgendamento(
        nome,
        String(payload.servico ?? ''),
        String(payload.data ?? ''),
        String(payload.horario ?? ''),
        String(payload.moto ?? ''),
      )
    case 'PEDIDO_CONFIRMADO':
      return msgPedidoConfirmado(nome, String(payload.numeroPedido ?? ''))
    case 'PEDIDO_ENVIADO':
      return msgPedidoEnviado(
        nome,
        String(payload.numeroPedido ?? ''),
        String(payload.rastreio ?? ''),
        String(payload.transportadora ?? 'Transportadora'),
      )
    case 'CARRINHO_ABANDONADO':
      return msgCarrinhoAbandonado(nome, (payload.produtos as string[]) ?? [])
    case 'POS_VENDA':
      return msgPosVenda(nome)
    case 'REATIVACAO':
      return msgReativacao(nome)
    case 'MANUAL':
      return String(payload.conteudo ?? '')
    default:
      return `Olá ${nome}! Aqui é a Forza Motos. 🏍️`
  }
}

/** Adiciona mensagem na fila */
export async function enfileirarMensagem(params: EnfileirarParams) {
  const conteudo = gerarConteudo(params.tipo, params.nome, params.payload ?? {})

  return prisma.crmMensagem.create({
    data: {
      whatsapp:    params.whatsapp,
      nome:        params.nome,
      tipo:        params.tipo,
      conteudo,
      leadId:      params.leadId,
      userId:      params.userId,
      payload:     (params.payload ?? {}) as any,
      agendadoPara: params.agendadoPara ?? new Date(),
      status:      'PENDENTE',
    },
  })
}

const MAX_TENTATIVAS = 3

/** Processa a fila — chame via cron a cada 5 minutos */
export async function processarFila(limite = 20): Promise<{ enviadas: number; falhas: number }> {
  const agora = new Date()

  const pendentes = await prisma.crmMensagem.findMany({
    where: {
      status: 'PENDENTE',
      agendadoPara: { lte: agora },
      tentativas: { lt: MAX_TENTATIVAS },
    },
    orderBy: { agendadoPara: 'asc' },
    take: limite,
  })

  let enviadas = 0
  let falhas = 0

  for (const msg of pendentes) {
    // Marca como enviando (lock otimista)
    await prisma.crmMensagem.update({
      where: { id: msg.id },
      data: { status: 'ENVIANDO', tentativas: { increment: 1 } },
    })

    const result = await enviarMensagem({
      whatsapp: msg.whatsapp,
      mensagem: msg.conteudo,
    })

    if (result.ok) {
      await prisma.crmMensagem.update({
        where: { id: msg.id },
        data: {
          status: 'ENVIADA',
          evolutionId: result.id,
          enviadaEm: new Date(),
          erro: null,
        },
      })

      // Atualiza etapa do lead para CONTATADO
      if (msg.leadId) {
        await prisma.crmLead.update({
          where: { id: msg.leadId },
          data: { etapa: 'CONTATADO' },
        }).catch(() => {})
      }

      enviadas++
    } else {
      const novasTentativas = msg.tentativas + 1
      const status = novasTentativas >= MAX_TENTATIVAS ? 'FALHA' : 'PENDENTE'

      await prisma.crmMensagem.update({
        where: { id: msg.id },
        data: {
          status,
          erro: result.erro,
          // Reagenda para 10 minutos depois em caso de falha parcial
          agendadoPara: status === 'PENDENTE'
            ? new Date(Date.now() + 10 * 60 * 1000)
            : msg.agendadoPara,
        },
      })

      if (status === 'FALHA') falhas++
    }

    // Pequena pausa entre envios para não violar rate limit da Evolution
    await new Promise(r => setTimeout(r, 500))
  }

  return { enviadas, falhas }
}
