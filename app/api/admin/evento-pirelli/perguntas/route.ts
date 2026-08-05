import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exigirAdmin, obterEventoPirelli } from '@/lib/evento-pirelli'

export async function GET() {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const evento = await obterEventoPirelli()
  return NextResponse.json(await prisma.eventoPirelliQuizPergunta.findMany({ where: { eventoId: evento.id }, orderBy: { ordem: 'asc' }, include: { opcoes: { orderBy: { ordem: 'asc' } } } }))
}

export async function POST(request: Request) {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json()
  const opcoes = Array.isArray(body.opcoes) ? body.opcoes : []
  if (!String(body.enunciado ?? '').trim() || opcoes.length < 2 || opcoes.filter((opcao: any) => opcao.correta).length !== 1) return NextResponse.json({ error: 'Informe a pergunta, ao menos duas opções e uma única correta.' }, { status: 400 })
  const evento = await obterEventoPirelli()
  const pergunta = await prisma.eventoPirelliQuizPergunta.create({
    data: { eventoId: evento.id, enunciado: body.enunciado.trim(), explicacao: String(body.explicacao ?? '').trim() || null, ordem: Number(body.ordem ?? 999), pontos: Math.max(1, Number(body.pontos ?? 1)), opcoes: { create: opcoes.map((opcao: any, ordem: number) => ({ texto: String(opcao.texto ?? '').trim(), correta: Boolean(opcao.correta), ordem })) } }, include: { opcoes: true },
  })
  return NextResponse.json(pergunta, { status: 201 })
}
