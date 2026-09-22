import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import { enfileirarMensagem } from '@/lib/evolution/queue'

type Db = Prisma.TransactionClient | typeof prisma

const RESULTADO_WHATSAPP_PADRAO = '5519992774625'
const RESULTADO_GRUPO_JID_PADRAO = '120363427125752663@g.us'

function textoEmUmaLinha(valor: string) {
  return valor.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

export function formatarDuracaoResultadoQuizPirelli(duracaoMs: number) {
  const duracao = Math.max(0, Math.trunc(duracaoMs))
  const minutos = Math.floor(duracao / 60_000)
  const segundos = Math.floor((duracao % 60_000) / 1_000)
  const centesimos = Math.floor((duracao % 1_000) / 10)
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`
}

export function conteudoResultadoQuizPirelli(params: {
  nome: string
  whatsapp: string
  pontuacao: number
  pontuacaoMaxima: number
  duracaoMs: number
}) {
  return `🏆 *RESULTADO DO QUIZ PIRELLI × FORZA MOTOS*

Vencedor: *${textoEmUmaLinha(params.nome)}*
WhatsApp: ${normalizarWhatsApp(params.whatsapp)}
Resultado: ${params.pontuacao}/${params.pontuacaoMaxima}
Tempo oficial: *${formatarDuracaoResultadoQuizPirelli(params.duracaoMs)}*

O resultado foi encerrado e congelado pelo painel administrativo.`
}

function destinoNumeroResultado() {
  return normalizarWhatsApp(
    process.env.EVENTO_PIRELLI_RESULTADO_WHATSAPP || RESULTADO_WHATSAPP_PADRAO,
  )
}

function destinoGrupoResultado() {
  const configurado = process.env.EVENTO_PIRELLI_RESULTADO_GRUPO_JID?.trim()
  const grupoJid = configurado || RESULTADO_GRUPO_JID_PADRAO
  if (!/^[\d-]+@g\.us$/.test(grupoJid)) {
    throw new Error('EVENTO_PIRELLI_RESULTADO_GRUPO_JID deve terminar em @g.us.')
  }
  return grupoJid
}

/**
 * Cria duas mensagens operacionais idempotentes: uma para o responsável e
 * outra para o grupo. O JID padrão foi resolvido previamente a partir do link
 * de convite informado para o evento; a instância precisa participar do grupo.
 */
export async function enfileirarResultadoQuizPirelli(params: {
  tentativaId: string
  nome: string
  whatsapp: string
  pontuacao: number
  pontuacaoMaxima: number
  duracaoMs: number
}, db: Db = prisma) {
  const conteudo = conteudoResultadoQuizPirelli(params)
  const destinos = [
    {
      canal: 'responsavel',
      whatsapp: destinoNumeroResultado(),
      nome: 'Equipe Forza Motos',
    },
    {
      canal: 'grupo',
      whatsapp: destinoGrupoResultado(),
      nome: 'Grupo Forza Motos',
    },
  ] as const

  return Promise.all(destinos.map((destino) => enfileirarMensagem({
    chaveIdempotencia: `evento-pirelli:quiz:${params.tentativaId}:resultado:${destino.canal}`.slice(0, 190),
    whatsapp: destino.whatsapp,
    nome: destino.nome,
    tipo: 'MANUAL',
    payload: {
      conteudo,
      eventoPirelli: true,
      motivo: 'RESULTADO_QUIZ',
      tentativaId: params.tentativaId,
      destino: destino.canal,
    },
  }, db)))
}
