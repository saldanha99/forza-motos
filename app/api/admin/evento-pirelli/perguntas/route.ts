import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bloquearQuizEvento, exigirAdmin, obterEventoPirelli } from '@/lib/evento-pirelli'

export async function GET() {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const evento = await obterEventoPirelli()
  return NextResponse.json(await prisma.eventoPirelliQuizPergunta.findMany({ where: { eventoId: evento.id }, orderBy: { ordem: 'asc' }, include: { opcoes: { orderBy: { ordem: 'asc' } } } }))
}

export async function POST(request: Request) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json()
  const tipo = body.tipo === 'TEXTO' ? 'TEXTO' : 'MULTIPLA_ESCOLHA'
  const opcoes = Array.isArray(body.opcoes) ? body.opcoes : []
  const enunciado = String(body.enunciado ?? '').trim()
  const respostaCorretaTexto = String(body.respostaCorretaTexto ?? '').trim()
  const opcoesValidas = opcoes.filter((opcao: any) => String(opcao.texto ?? '').trim())
  if (!enunciado) return NextResponse.json({ error: 'Informe o enunciado da pergunta.' }, { status: 400 })
  if (tipo === 'TEXTO' && !respostaCorretaTexto) return NextResponse.json({ error: 'Informe a resposta correta da pergunta aberta.' }, { status: 400 })
  if (tipo === 'MULTIPLA_ESCOLHA' && (opcoesValidas.length < 2 || opcoesValidas.filter((opcao: any) => opcao.correta).length !== 1)) {
    return NextResponse.json({ error: 'Informe ao menos duas opções preenchidas e uma única correta.' }, { status: 400 })
  }
  const evento = await obterEventoPirelli()
  try {
    const pergunta = await prisma.$transaction(async (tx) => {
      await bloquearQuizEvento(tx, evento.id)
      const [tentativas, estado] = await Promise.all([
        tx.eventoPirelliQuizTentativa.count({ where: { visitante: { eventoId: evento.id } } }),
        tx.eventoPirelli.findUniqueOrThrow({ where: { id: evento.id }, select: { quizEncerradoEm: true } }),
      ])
      if (tentativas > 0 || estado.quizEncerradoEm) throw new Error('QUIZ_CONGELADO')
      return tx.eventoPirelliQuizPergunta.create({
        data: {
          eventoId: evento.id,
          enunciado,
          explicacao: String(body.explicacao ?? '').trim() || null,
          tipo,
          respostaCorretaTexto: tipo === 'TEXTO' ? respostaCorretaTexto : null,
          ordem: Number(body.ordem ?? 999),
          pontos: Math.max(1, Number(body.pontos ?? 1)),
          opcoes: tipo === 'MULTIPLA_ESCOLHA'
            ? { create: opcoesValidas.map((opcao: any, ordem: number) => ({ texto: String(opcao.texto).trim(), correta: Boolean(opcao.correta), ordem })) }
            : undefined,
        },
        include: { opcoes: true },
      })
    })
    return NextResponse.json(pergunta, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'QUIZ_CONGELADO') {
      return NextResponse.json({ error: 'As perguntas foram congeladas quando a primeira tentativa começou.' }, { status: 409 })
    }
    throw error
  }
}
