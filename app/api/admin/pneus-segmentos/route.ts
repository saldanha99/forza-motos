/**
 * GET  /api/admin/pneus-segmentos — lista os segmentos com a contagem de pneus
 * POST /api/admin/pneus-segmentos — cria um segmento
 *
 * Segmento é a categoria de uso do pneu que aparece em /pneus (Custom, Big
 * Trail, Esportivo/Street, Scooter). Fica em tabela para a loja criar e
 * renomear sem depender de deploy.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugLinha } from '@/lib/pneus/segmentos'

export const dynamic = 'force-dynamic'

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const segmentos = await prisma.pneuSegmento.findMany({
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: { _count: { select: { produtos: true } } },
  })

  return NextResponse.json(
    segmentos.map(({ _count, ...s }) => ({ ...s, produtos: _count.produtos })),
  )
}

export async function POST(req: Request) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const nome = String(body.nome ?? '').trim()
  if (!nome) return NextResponse.json({ error: 'Informe o nome da categoria.' }, { status: 400 })

  const slug = slugLinha(nome)
  if (!slug) {
    return NextResponse.json(
      { error: 'O nome precisa ter ao menos uma letra ou número.' },
      { status: 400 },
    )
  }

  const jaExiste = await prisma.pneuSegmento.findFirst({
    where: { OR: [{ nome }, { slug }] },
    select: { id: true },
  })
  if (jaExiste) {
    return NextResponse.json({ error: 'Já existe uma categoria com esse nome.' }, { status: 409 })
  }

  // Entra no fim da lista; a ordem fina é ajustada pelas setas da tela.
  const ultimo = await prisma.pneuSegmento.findFirst({
    orderBy: { ordem: 'desc' },
    select: { ordem: true },
  })

  const segmento = await prisma.pneuSegmento.create({
    data: {
      nome,
      slug,
      descricao: String(body.descricao ?? '').trim() || null,
      ordem: (ultimo?.ordem ?? 0) + 1,
      ativo: body.ativo !== false,
    },
  })

  return NextResponse.json({ ...segmento, produtos: 0 }, { status: 201 })
}
