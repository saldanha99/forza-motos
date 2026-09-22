import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bloquearQuizEvento, exigirAdmin } from '@/lib/evento-pirelli'

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json()
  const existente = await prisma.eventoPirelliQuizPergunta.findUnique({ where: { id: params.id }, select: { eventoId: true } })
  if (!existente) return NextResponse.json({ error: 'Pergunta não encontrada.' }, { status: 404 })
  try {
    const pergunta = await prisma.$transaction(async (tx) => {
      await bloquearQuizEvento(tx, existente.eventoId)
      const [tentativas, estado] = await Promise.all([
        tx.eventoPirelliQuizTentativa.count({ where: { visitante: { eventoId: existente.eventoId } } }),
        tx.eventoPirelli.findUniqueOrThrow({ where: { id: existente.eventoId }, select: { quizEncerradoEm: true } }),
      ])
      if (tentativas > 0 || estado.quizEncerradoEm) throw new Error('QUIZ_CONGELADO')
      return tx.eventoPirelliQuizPergunta.update({
        where: { id: params.id },
        data: {
          ativa: typeof body.ativa === 'boolean' ? body.ativa : undefined,
          ordem: Number.isFinite(body.ordem) ? Number(body.ordem) : undefined,
          enunciado: typeof body.enunciado === 'string' ? body.enunciado.trim() : undefined,
          explicacao: typeof body.explicacao === 'string' ? body.explicacao.trim() || null : undefined,
          respostaCorretaTexto: typeof body.respostaCorretaTexto === 'string' ? body.respostaCorretaTexto.trim() || null : undefined,
          pontos: Number.isFinite(body.pontos) ? Math.max(1, Number(body.pontos)) : undefined,
        },
      })
    })
    return NextResponse.json(pergunta)
  } catch (error) {
    if (error instanceof Error && error.message === 'QUIZ_CONGELADO') {
      return NextResponse.json({ error: 'As perguntas foram congeladas quando a primeira tentativa começou.' }, { status: 409 })
    }
    throw error
  }
}
