import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarElegibilidadeDeCaneca, eventoDisponivel, reconciliarElegibilidadeQuiz } from '@/lib/evento-pirelli'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const codigo = new URL(request.url).searchParams.get('codigo')
  if (!codigo) return NextResponse.json({ error: 'Identificação ausente.' }, { status: 400 })
  const visitante = await prisma.eventoPirelliVisitante.findUnique({ where: { codigoQr: codigo }, include: { tentativaQuiz: true, evento: true } })
  if (!visitante) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
  if (!eventoDisponivel(visitante.evento)) return NextResponse.json({ error: 'Este evento não está mais disponível.' }, { status: 403 })
  if (visitante.tentativaQuiz) {
    if (visitante.tentativaQuiz.acertouTodas) await reconciliarElegibilidadeQuiz(visitante.id)
    return NextResponse.json({ tentativa: visitante.tentativaQuiz, perguntas: [] })
  }
  const perguntas = await prisma.eventoPirelliQuizPergunta.findMany({
    where: { eventoId: visitante.eventoId, ativa: true }, orderBy: { ordem: 'asc' },
    include: { opcoes: { where: { ativa: true }, orderBy: { ordem: 'asc' }, select: { id: true, texto: true } } },
  })
  return NextResponse.json({ perguntas })
}

export async function POST(request: Request) {
  let visitanteId: string | undefined
  try {
    const body = await request.json()
    const codigo = String(body.codigo ?? '')
    const respostas = body.respostas as Record<string, string>
    const visitante = await prisma.eventoPirelliVisitante.findUnique({ where: { codigoQr: codigo }, include: { tentativaQuiz: true, evento: true } })
    if (!visitante) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
    visitanteId = visitante.id
    if (!eventoDisponivel(visitante.evento)) return NextResponse.json({ error: 'Este evento não está mais disponível.' }, { status: 403 })
    if (visitante.tentativaQuiz) {
      if (visitante.tentativaQuiz.acertouTodas) await reconciliarElegibilidadeQuiz(visitante.id)
      return NextResponse.json({ error: 'Esta é a única tentativa oficial do quiz.' }, { status: 409 })
    }
    const perguntas = await prisma.eventoPirelliQuizPergunta.findMany({
      where: { eventoId: visitante.eventoId, ativa: true }, orderBy: { ordem: 'asc' }, include: { opcoes: { where: { ativa: true } } },
    })
    if (!perguntas.length || perguntas.some((p) => !respostas?.[p.id])) return NextResponse.json({ error: 'Responda todas as perguntas.' }, { status: 400 })
    let pontuacao = 0
    const respostasCriadas = perguntas.map((pergunta) => {
      const opcao = pergunta.opcoes.find((item) => item.id === respostas[pergunta.id])
      if (!opcao) throw new Error('Resposta inválida')
      const pontosGanhos = opcao.correta ? pergunta.pontos : 0
      pontuacao += pontosGanhos
      return { perguntaId: pergunta.id, opcaoId: opcao.id, enunciadoSnapshot: pergunta.enunciado, opcaoSnapshot: opcao.texto, corretaSnapshot: opcao.correta, pontosGanhos }
    })
    const maxima = perguntas.reduce((total, pergunta) => total + pergunta.pontos, 0)
    // Tentativa + respostas + elegibilidade/caneca são atômicas: se a segunda etapa falhar,
    // a tentativa some junto e a tentativa única do quiz continua liberada para retry.
    const tentativa = await prisma.$transaction(async (tx) => {
      const criada = await tx.eventoPirelliQuizTentativa.create({
        data: { visitanteId: visitante.id, pontuacao, pontuacaoMaxima: maxima, acertouTodas: pontuacao === maxima, respostas: { create: respostasCriadas } },
      })
      if (criada.acertouTodas) await criarElegibilidadeDeCaneca({ visitanteId: visitante.id, origem: 'QUIZ_PERFEITO', validadoPor: 'Sistema' }, tx)
      return criada
    })
    return NextResponse.json({ tentativa, elegivelCaneca: tentativa.acertouTodas })
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // Corrida em cima da tentativa única; se por acaso ficou uma tentativa perfeita órfã
      // de uma execução anterior, o self-heal cobre antes de devolver o 409.
      if (visitanteId) await reconciliarElegibilidadeQuiz(visitanteId)
      return NextResponse.json({ error: 'Esta é a única tentativa oficial do quiz.' }, { status: 409 })
    }
    return NextResponse.json({ error: error?.message === 'Resposta inválida' ? error.message : 'Não foi possível registrar a tentativa.' }, { status: 400 })
  }
}
