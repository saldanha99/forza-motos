/**
 * /api/glossario — CRUD básico do glossário
 *
 * GET    ?search=&status=&letra=  → lista termos (admin)
 * POST   { termo, letra, nicho }  → cria termo pendente
 * PUT    { id, termo?, nicho? }   → edição inline
 * DELETE { id }                   → exclui termo
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') return null
  return session
}

// ── GET — lista todos os termos (com filtros) ─────────────────────────────────
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const search = req.nextUrl.searchParams.get('search') ?? undefined
  const status = req.nextUrl.searchParams.get('status') ?? undefined   // 'publicado'|'pendente'
  const letra  = req.nextUrl.searchParams.get('letra')  ?? undefined

  const where: any = {}
  if (search)           where.OR = [{ termo: { contains: search, mode: 'insensitive' } }, { nicho: { contains: search, mode: 'insensitive' } }]
  if (letra)            where.letra = letra.toUpperCase()
  if (status === 'publicado') where.publicado = true
  if (status === 'pendente')  where.publicado = false

  const termos = await prisma.glossaryTerm.findMany({
    where,
    orderBy: [{ letra: 'asc' }, { termo: 'asc' }],
    take: 500,
    select: {
      id: true, termo: true, slug: true, letra: true, nicho: true,
      categoria: true, publicado: true, revisado: true, origem: true,
      seoTitle: true, resumo: true, views: true, createdAt: true, updatedAt: true,
    },
  })

  return NextResponse.json(termos)
}

// ── POST — cria termo pendente ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { termo, letra, nicho } = await req.json().catch(() => ({}))
  if (!termo?.trim() || !letra?.trim()) {
    return NextResponse.json({ error: '"termo" e "letra" são obrigatórios' }, { status: 400 })
  }

  try {
    const created = await prisma.glossaryTerm.create({
      data: {
        termo:     termo.trim(),
        slug:      slugify(termo.trim()),
        letra:     letra.trim().toUpperCase().charAt(0),
        nicho:     nicho?.trim() || null,
        conteudo:  '',
        publicado: false,
        origem:    'MANUAL',
      },
    })
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Termo já cadastrado (slug duplicado)' }, { status: 409 })
    }
    return NextResponse.json({ error: e?.message }, { status: 500 })
  }
}

// ── PUT — edição inline ───────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id, termo, nicho, publicado } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })

  const data: any = {}
  if (termo    !== undefined) { data.termo = termo.trim(); data.slug = slugify(termo.trim()); data.letra = termo.trim().charAt(0).toUpperCase() }
  if (nicho    !== undefined) data.nicho    = nicho?.trim() || null
  if (publicado !== undefined) data.publicado = publicado

  const updated = await prisma.glossaryTerm.update({ where: { id }, data })
  return NextResponse.json(updated)
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })

  await prisma.glossaryTerm.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
