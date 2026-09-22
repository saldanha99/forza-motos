import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bloquearQuizEventoCompartilhado, eventoDisponivel, mensagemEventoPirelliIndisponivel, normalizarRespostaQuizTexto } from '@/lib/evento-pirelli'
import {
  calcularDuracaoQuiz,
  criarOrdemQuiz,
  fixarPerguntaFinalNoFim,
  lerOrdemOpcoes,
  lerOrdemPerguntas,
} from '@/lib/eventos/quiz-pirelli'

export const dynamic = 'force-dynamic'

const MAX_PAYLOAD_BYTES = 16 * 1024

async function lerTentativa(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
  const tamanhoDeclarado = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanhoDeclarado) && tamanhoDeclarado > MAX_PAYLOAD_BYTES) return null
  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_BYTES) return null

  let body: unknown
  try { body = JSON.parse(texto) } catch { return null }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  const registro = body as Record<string, unknown>
  if (Object.keys(registro).some((campo) => campo !== 'codigo' && campo !== 'respostas')) return null
  const codigo = typeof registro.codigo === 'string' ? registro.codigo.trim() : ''
  const respostas = registro.respostas
  if (!codigo || codigo.length > 100 || !respostas || typeof respostas !== 'object' || Array.isArray(respostas)) return null

  const entradas = Object.entries(respostas as Record<string, unknown>)
  if (entradas.length > 40 || entradas.some(([id, valor]) => !id || id.length > 100 || typeof valor !== 'string' || valor.length > 200)) return null
  return { codigo, respostas: Object.fromEntries(entradas) as Record<string, string> }
}

type ClientePerguntasQuiz = Pick<Prisma.TransactionClient, 'eventoPirelliQuizPergunta'>

async function buscarPerguntas(eventoId: string, ids?: string[], cliente: ClientePerguntasQuiz = prisma) {
  return cliente.eventoPirelliQuizPergunta.findMany({
    where: { eventoId, ativa: true, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: { ordem: 'asc' },
    include: { opcoes: { where: { ativa: true }, orderBy: { ordem: 'asc' } } },
  })
}

async function posicaoTentativa(eventoId: string, tentativa: {
  id: string
  acertouTodas: boolean
  duracaoMs: number | null
  concluidaEm: Date | null
}) {
  if (!tentativa.acertouTodas || tentativa.duracaoMs === null || tentativa.concluidaEm === null) return null
  const melhores = await prisma.eventoPirelliQuizTentativa.count({
    where: {
      acertouTodas: true,
      concluidaEm: { not: null },
      visitante: { eventoId },
      OR: [
        { duracaoMs: { lt: tentativa.duracaoMs } },
        { duracaoMs: tentativa.duracaoMs, concluidaEm: { lt: tentativa.concluidaEm } },
        { duracaoMs: tentativa.duracaoMs, concluidaEm: tentativa.concluidaEm, id: { lt: tentativa.id } },
      ],
    },
  })
  return melhores + 1
}

function ordenarPerguntas<T extends { id: string; respostaCorretaTexto?: string | null; opcoes: Array<{ id: string }> }>(
  perguntas: T[],
  ordemPerguntas: string[],
  ordemOpcoes: Record<string, string[]>,
) {
  const porId = new Map(perguntas.map((pergunta) => [pergunta.id, pergunta]))
  const perguntasOrdenadas = ordemPerguntas.flatMap((id) => {
    const pergunta = porId.get(id)
    if (!pergunta) return []
    const opcoesPorId = new Map(pergunta.opcoes.map((opcao) => [opcao.id, opcao]))
    return [{
      ...pergunta,
      opcoes: (ordemOpcoes[id] ?? []).flatMap((opcaoId) => {
        const opcao = opcoesPorId.get(opcaoId)
        return opcao ? [opcao] : []
      }),
    }]
  })
  return fixarPerguntaFinalNoFim(perguntasOrdenadas)
}

function perguntasPublicas(perguntas: Awaited<ReturnType<typeof buscarPerguntas>>) {
  return perguntas.map((pergunta) => ({
    id: pergunta.id,
    enunciado: pergunta.enunciado,
    tipo: pergunta.tipo,
    pontos: pergunta.pontos,
    opcoes: pergunta.opcoes.map((opcao) => ({ id: opcao.id, texto: opcao.texto })),
  }))
}

export async function GET(request: Request) {
  const codigo = new URL(request.url).searchParams.get('codigo')?.trim()
  if (!codigo || codigo.length > 100) return NextResponse.json({ error: 'Identificação ausente.' }, { status: 400 })

  const visitante = await prisma.eventoPirelliVisitante.findUnique({
    where: { codigoQr: codigo },
    include: { tentativaQuiz: true, evento: true },
  })
  if (!visitante) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })

  let tentativa = visitante.tentativaQuiz
  if (tentativa?.concluidaEm) {
    const posicaoAtual = await posicaoTentativa(visitante.eventoId, tentativa)
    return NextResponse.json({
      tentativa,
      perguntas: [],
      classificadoQuiz: tentativa.acertouTodas,
      posicaoAtual,
      quizEncerrado: visitante.evento.quizEncerradoEm !== null,
      vencedorQuiz: visitante.evento.quizVencedorTentativaId === tentativa.id,
    })
  }
  if (!eventoDisponivel(visitante.evento)) {
    return NextResponse.json({ error: mensagemEventoPirelliIndisponivel(visitante.evento) }, { status: 403 })
  }
  if (visitante.evento.quizEncerradoEm) {
    return NextResponse.json({ error: 'O quiz já foi encerrado e não aceita novas respostas.' }, { status: 409 })
  }

  if (!tentativa) {
    try {
      tentativa = await prisma.$transaction(async (tx) => {
        await bloquearQuizEventoCompartilhado(tx, visitante.eventoId)
        const eventoAtual = await tx.eventoPirelli.findUniqueOrThrow({
          where: { id: visitante.eventoId },
          select: { quizEncerradoEm: true },
        })
        if (eventoAtual.quizEncerradoEm) throw new Error('QUIZ_ENCERRADO')
        const existente = await tx.eventoPirelliQuizTentativa.findUnique({ where: { visitanteId: visitante.id } })
        if (existente) return existente
        const perguntas = await buscarPerguntas(visitante.eventoId, undefined, tx)
        if (!perguntas.length) throw new Error('QUIZ_SEM_PERGUNTAS')
        const ordem = criarOrdemQuiz(perguntas)
        const [relogio] = await tx.$queryRaw<Array<{ agora: Date }>>`
          SELECT clock_timestamp() AS "agora"
        `
        if (!relogio?.agora) throw new Error('CRONOMETRO_INVALIDO')
        return tx.eventoPirelliQuizTentativa.create({
          data: {
            visitanteId: visitante.id,
            iniciadaEm: relogio.agora,
            ordemPerguntas: ordem.ordemPerguntas,
            ordemOpcoes: ordem.ordemOpcoes,
          },
        })
      })
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : ''
      if (mensagem === 'QUIZ_ENCERRADO') {
        return NextResponse.json({ error: 'O quiz já foi encerrado e não aceita novas tentativas.' }, { status: 409 })
      }
      if (mensagem === 'QUIZ_SEM_PERGUNTAS') {
        return NextResponse.json({ error: 'O quiz ainda não possui perguntas ativas.' }, { status: 409 })
      }
      if (mensagem === 'CRONOMETRO_INVALIDO') {
        return NextResponse.json({ error: 'Não foi possível iniciar o cronômetro oficial.' }, { status: 409 })
      }
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      tentativa = await prisma.eventoPirelliQuizTentativa.findUniqueOrThrow({ where: { visitanteId: visitante.id } })
    }
  }

  const ordemPerguntas = lerOrdemPerguntas(tentativa.ordemPerguntas)
  const ordemOpcoes = lerOrdemOpcoes(tentativa.ordemOpcoes)
  if (!ordemPerguntas.length) return NextResponse.json({ error: 'Não foi possível recuperar a ordem oficial do quiz.' }, { status: 409 })
  const perguntas = ordenarPerguntas(await buscarPerguntas(visitante.eventoId, ordemPerguntas), ordemPerguntas, ordemOpcoes)
  if (perguntas.length !== ordemPerguntas.length) {
    return NextResponse.json({ error: 'O quiz foi alterado depois do início. Procure o atendimento do evento.' }, { status: 409 })
  }
  return NextResponse.json({ tentativa: { id: tentativa.id, iniciadaEm: tentativa.iniciadaEm }, perguntas: perguntasPublicas(perguntas) })
}

export async function POST(request: Request) {
  try {
    const entrada = await lerTentativa(request)
    if (!entrada) return NextResponse.json({ error: 'Tentativa inválida.' }, { status: 400 })
    const [relogioRecebimento] = await prisma.$queryRaw<Array<{ agora: Date }>>`
      SELECT clock_timestamp() AS "agora"
    `
    if (!relogioRecebimento?.agora) throw new Error('CRONOMETRO_INVALIDO')
    const concluidaEmRecebida = relogioRecebimento.agora

    const visitante = await prisma.eventoPirelliVisitante.findUnique({
      where: { codigoQr: entrada.codigo },
      include: { tentativaQuiz: true, evento: true },
    })
    if (!visitante) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
    if (!eventoDisponivel(visitante.evento)) {
      return NextResponse.json({ error: mensagemEventoPirelliIndisponivel(visitante.evento) }, { status: 403 })
    }
    const tentativaAtual = visitante.tentativaQuiz
    if (!tentativaAtual) return NextResponse.json({ error: 'Abra o quiz antes de enviar as respostas.' }, { status: 409 })
    if (tentativaAtual.concluidaEm) return NextResponse.json({ error: 'Esta é a única tentativa oficial do quiz.' }, { status: 409 })

    const ordemPerguntas = lerOrdemPerguntas(tentativaAtual.ordemPerguntas)
    const ordemOpcoes = lerOrdemOpcoes(tentativaAtual.ordemOpcoes)
    const idsRespondidos = Object.keys(entrada.respostas)
    if (!ordemPerguntas.length || idsRespondidos.length !== ordemPerguntas.length
        || idsRespondidos.some((id) => !ordemPerguntas.includes(id))) {
      return NextResponse.json({ error: 'Responda todas as perguntas, sem alterar o formulário.' }, { status: 400 })
    }

    const perguntas = ordenarPerguntas(await buscarPerguntas(visitante.eventoId, ordemPerguntas), ordemPerguntas, ordemOpcoes)
    if (perguntas.length !== ordemPerguntas.length || perguntas.some((pergunta) => !entrada.respostas[pergunta.id]?.trim())) {
      return NextResponse.json({ error: 'Responda todas as perguntas.' }, { status: 400 })
    }

    let pontuacao = 0
    const respostasCriadas = perguntas.map((pergunta) => {
      const valor = entrada.respostas[pergunta.id].trim()
      if (pergunta.tipo === 'TEXTO') {
        if (!pergunta.respostaCorretaTexto) throw new Error('Pergunta aberta sem gabarito')
        const correta = normalizarRespostaQuizTexto(valor) === normalizarRespostaQuizTexto(pergunta.respostaCorretaTexto)
        const pontosGanhos = correta ? pergunta.pontos : 0
        pontuacao += pontosGanhos
        return {
          tentativaId: tentativaAtual.id,
          perguntaId: pergunta.id,
          opcaoId: null,
          respostaTexto: valor,
          enunciadoSnapshot: pergunta.enunciado,
          opcaoSnapshot: valor,
          corretaSnapshot: correta,
          pontosGanhos,
        }
      }

      const opcao = pergunta.opcoes.find((item) => item.id === valor)
      if (!opcao) throw new Error('Resposta inválida')
      const pontosGanhos = opcao.correta ? pergunta.pontos : 0
      pontuacao += pontosGanhos
      return {
        tentativaId: tentativaAtual.id,
        perguntaId: pergunta.id,
        opcaoId: opcao.id,
        respostaTexto: null,
        enunciadoSnapshot: pergunta.enunciado,
        opcaoSnapshot: opcao.texto,
        corretaSnapshot: opcao.correta,
        pontosGanhos,
      }
    })

    const pontuacaoMaxima = perguntas.reduce((total, pergunta) => total + pergunta.pontos, 0)
    const acertouTodas = pontuacao === pontuacaoMaxima

    const tentativa = await prisma.$transaction(async (tx) => {
      await bloquearQuizEventoCompartilhado(tx, visitante.eventoId)
      const eventoAtual = await tx.eventoPirelli.findUniqueOrThrow({
        where: { id: visitante.eventoId },
        select: { quizEncerradoEm: true },
      })
      if (eventoAtual.quizEncerradoEm) throw new Error('QUIZ_ENCERRADO')
      const concluidaEm = concluidaEmRecebida
      const duracaoMs = calcularDuracaoQuiz(tentativaAtual.iniciadaEm, concluidaEm)
      const atualizada = await tx.eventoPirelliQuizTentativa.updateMany({
        where: { id: tentativaAtual.id, concluidaEm: null },
        data: { pontuacao, pontuacaoMaxima, acertouTodas, concluidaEm, duracaoMs },
      })
      if (atualizada.count !== 1) throw new Error('TENTATIVA_JA_CONCLUIDA')
      await tx.eventoPirelliQuizResposta.createMany({ data: respostasCriadas })
      return tx.eventoPirelliQuizTentativa.findUniqueOrThrow({ where: { id: tentativaAtual.id } })
    })

    const [posicaoAtual, apuracao] = await Promise.all([
      posicaoTentativa(visitante.eventoId, tentativa),
      prisma.eventoPirelli.findUniqueOrThrow({
        where: { id: visitante.eventoId },
        select: { quizEncerradoEm: true, quizVencedorTentativaId: true },
      }),
    ])

    return NextResponse.json({
      tentativa,
      classificadoQuiz: acertouTodas,
      posicaoAtual,
      quizEncerrado: apuracao.quizEncerradoEm !== null,
      vencedorQuiz: apuracao.quizVencedorTentativaId === tentativa.id,
    })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : ''
    if (mensagem === 'TENTATIVA_JA_CONCLUIDA') {
      return NextResponse.json({ error: 'Esta é a única tentativa oficial do quiz.' }, { status: 409 })
    }
    if (mensagem === 'QUIZ_ENCERRADO') {
      return NextResponse.json({ error: 'O quiz foi encerrado antes do envio. Procure a equipe do evento.' }, { status: 409 })
    }
    if (mensagem === 'CRONOMETRO_INVALIDO') {
      return NextResponse.json({ error: 'Não foi possível validar o cronômetro. Procure a equipe do evento.' }, { status: 409 })
    }
    if (mensagem === 'Resposta inválida') return NextResponse.json({ error: mensagem }, { status: 400 })
    console.error('[evento-pirelli/quiz]', error)
    return NextResponse.json({ error: 'Não foi possível registrar a tentativa.' }, { status: 400 })
  }
}
