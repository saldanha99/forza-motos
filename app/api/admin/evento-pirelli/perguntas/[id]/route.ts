import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAdmin } from '@/lib/evento-pirelli'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json()
  const pergunta = await prisma.eventoPirelliQuizPergunta.update({ where: { id: params.id }, data: { ativa: typeof body.ativa === 'boolean' ? body.ativa : undefined, ordem: Number.isFinite(body.ordem) ? Number(body.ordem) : undefined, enunciado: typeof body.enunciado === 'string' ? body.enunciado.trim() : undefined, explicacao: typeof body.explicacao === 'string' ? body.explicacao.trim() || null : undefined, pontos: Number.isFinite(body.pontos) ? Math.max(1, Number(body.pontos)) : undefined } })
  return NextResponse.json(pergunta)
}
