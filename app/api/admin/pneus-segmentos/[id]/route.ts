/**
 * PATCH  /api/admin/pneus-segmentos/[id] — renomeia, reordena ou (des)ativa
 * DELETE /api/admin/pneus-segmentos/[id] — remove a categoria
 *
 * Renomear troca o slug, e o slug é a URL pública (/pneus/categoria/<slug>).
 * Quem renomeia uma categoria já divulgada perde o link antigo — por isso a
 * tela avisa antes.
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

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const atual = await prisma.pneuSegmento.findUnique({ where: { id } })
  if (!atual) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: {
    nome?: string
    slug?: string
    descricao?: string | null
    ordem?: number
    ativo?: boolean
  } = {}

  if (typeof body.nome === 'string') {
    const nome = body.nome.trim()
    const slug = slugLinha(nome)
    if (!nome || !slug) {
      return NextResponse.json({ error: 'Nome inválido para a categoria.' }, { status: 400 })
    }
    const conflito = await prisma.pneuSegmento.findFirst({
      where: { id: { not: id }, OR: [{ nome }, { slug }] },
      select: { id: true },
    })
    if (conflito) {
      return NextResponse.json({ error: 'Já existe uma categoria com esse nome.' }, { status: 409 })
    }
    data.nome = nome
    data.slug = slug
  }

  if ('descricao' in body) {
    data.descricao = String(body.descricao ?? '').trim() || null
  }

  if (body.ordem !== undefined) {
    const ordem = Number(body.ordem)
    if (!Number.isFinite(ordem)) {
      return NextResponse.json({ error: 'Ordem inválida.' }, { status: 400 })
    }
    data.ordem = Math.trunc(ordem)
  }

  if (typeof body.ativo === 'boolean') data.ativo = body.ativo

  const segmento = await prisma.pneuSegmento.update({ where: { id }, data })
  return NextResponse.json(segmento)
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const segmento = await prisma.pneuSegmento.findUnique({
    where: { id },
    include: { _count: { select: { produtos: true } } },
  })
  if (!segmento) return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })

  // Apagar com produtos dentro apenas os desclassificaria em silêncio (a FK é
  // SetNull). Melhor obrigar a mover ou desativar, que é reversível.
  if (segmento._count.produtos > 0) {
    return NextResponse.json(
      {
        error: `Esta categoria tem ${segmento._count.produtos} produto(s). Troque a categoria deles ou desative em vez de apagar.`,
      },
      { status: 409 },
    )
  }

  await prisma.pneuSegmento.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
