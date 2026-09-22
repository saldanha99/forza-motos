import { after, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encerrarQuizEConfirmarVencedor, exigirAdmin, obterEventoPirelli } from '@/lib/evento-pirelli'
import { compararResultadosQuiz } from '@/lib/eventos/quiz-pirelli'
import { enfileirarConfirmacaoCanecaPirelli } from '@/lib/eventos/notificacoes-caneca-pirelli'
import { enfileirarResultadoQuizPirelli } from '@/lib/eventos/notificacoes-resultado-quiz-pirelli'
import { intervaloWhatsAppMs, processarMensagem } from '@/lib/evolution/queue'

export const dynamic = 'force-dynamic'

async function painelQuizDoEvento(eventoId: string) {
  const [tentativas, evento] = await Promise.all([
    prisma.eventoPirelliQuizTentativa.findMany({
      where: {
        visitante: { eventoId },
      },
      orderBy: [{ iniciadaEm: 'desc' }],
      select: {
        id: true,
        pontuacao: true,
        pontuacaoMaxima: true,
        acertouTodas: true,
        iniciadaEm: true,
        concluidaEm: true,
        duracaoMs: true,
        visitante: {
          select: {
            id: true,
            nomeCompleto: true,
            whatsapp: true,
            nomeGravacao: true,
          },
        },
      },
    }),
    prisma.eventoPirelli.findUniqueOrThrow({
      where: { id: eventoId },
      select: {
        quizEncerradoEm: true,
        quizEncerradoPor: true,
        quizVencedorTentativaId: true,
      },
    }),
  ])
  const perfeitas = tentativas
    .filter((tentativa) => tentativa.acertouTodas && tentativa.duracaoMs !== null && tentativa.concluidaEm !== null)
    .sort(compararResultadosQuiz)
  const ranking = perfeitas.map((tentativa, indice) => ({
    ...tentativa,
    posicao: indice + 1,
    vencedorConfirmado: tentativa.id === evento.quizVencedorTentativaId,
  }))
  const posicoes = new Map(ranking.map((tentativa) => [tentativa.id, tentativa.posicao]))
  return {
    ranking,
    tentativas: tentativas.slice(0, 100).map((tentativa) => ({
      ...tentativa,
      posicao: posicoes.get(tentativa.id) ?? null,
      vencedorConfirmado: tentativa.id === evento.quizVencedorTentativaId,
    })),
    resumo: {
      total: tentativas.length,
      concluidas: tentativas.filter((tentativa) => tentativa.concluidaEm !== null).length,
      perfeitas: perfeitas.length,
      emAndamento: tentativas.filter((tentativa) => tentativa.concluidaEm === null).length,
    },
    apuracao: evento,
    atualizadoEm: new Date(),
  }
}

export async function GET() {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const evento = await obterEventoPirelli()
  return NextResponse.json(await painelQuizDoEvento(evento.id))
}

export async function POST(request: Request) {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    if (!['encerrar-e-apurar', 'confirmar-vencedor'].includes(body?.acao)) {
      return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }
    const evento = await obterEventoPirelli()
    const vencedor = await encerrarQuizEConfirmarVencedor(evento.id, session.user.email ?? 'Equipe')
    if (vencedor) {
      after(async () => {
        try {
          const [mensagemVencedor, mensagensEquipe] = await Promise.all([
            enfileirarConfirmacaoCanecaPirelli({
              visitanteId: vencedor.visitanteId,
              motivo: 'PREMIO_QUIZ',
              referencia: vencedor.id,
            }),
            enfileirarResultadoQuizPirelli({
              tentativaId: vencedor.id,
              nome: vencedor.visitante.nomeCompleto,
              whatsapp: vencedor.visitante.whatsapp,
              pontuacao: vencedor.pontuacao,
              pontuacaoMaxima: vencedor.pontuacaoMaxima,
              duracaoMs: vencedor.duracaoMs!,
            }),
          ])
          const mensagens = [mensagemVencedor, ...mensagensEquipe].filter((item) => item !== null)
          for (let indice = 0; indice < mensagens.length; indice += 1) {
            if (indice > 0) {
              await new Promise((resolve) => setTimeout(resolve, intervaloWhatsAppMs() + 100))
            }
            await processarMensagem(mensagens[indice].id)
          }
        } catch (error) {
          console.error('[evento-pirelli/quiz] Falha ao notificar resultado:', error)
        }
      })
    }
    return NextResponse.json({ vencedor, ...await painelQuizDoEvento(evento.id) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Não foi possível confirmar o vencedor.' }, { status: 400 })
  }
}
