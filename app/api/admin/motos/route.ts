/**
 * GET  /api/admin/motos — lista motos (com contagem de produtos vinculados)
 * POST /api/admin/motos — cria uma moto (marca, modelo, anoDe, anoAte?)
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarSlugMoto } from '@/lib/moto'

export const dynamic = 'force-dynamic'

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function GET() {
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const motos = await prisma.moto.findMany({
    orderBy: [{ marca: 'asc' }, { modelo: 'asc' }, { anoDe: 'asc' }],
    include: { _count: { select: { produtos: true } } },
  })
  return NextResponse.json(
    motos.map((m) => ({
      id: m.id, marca: m.marca, modelo: m.modelo, anoDe: m.anoDe, anoAte: m.anoAte,
      slug: m.slug, produtos: m._count.produtos,
    }))
  )
}

export async function POST(req: Request) {
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const marca = String(body.marca ?? '').trim()
  const modelo = String(body.modelo ?? '').trim()
  const anoDe = Number(body.anoDe)
  const anoAte = body.anoAte ? Number(body.anoAte) : null

  if (!marca || !modelo) return NextResponse.json({ error: 'Informe marca e modelo.' }, { status: 400 })
  if (!Number.isInteger(anoDe) || anoDe < 1950 || anoDe > 2100) {
    return NextResponse.json({ error: 'Ano inicial inválido.' }, { status: 400 })
  }
  if (anoAte != null && (anoAte < anoDe)) {
    return NextResponse.json({ error: 'Ano final não pode ser menor que o inicial.' }, { status: 400 })
  }

  const slug = gerarSlugMoto(marca, modelo, anoDe, anoAte)
  const existe = await prisma.moto.findUnique({ where: { slug } })
  if (existe) return NextResponse.json({ error: 'Já existe essa moto/faixa de ano.' }, { status: 409 })

  const moto = await prisma.moto.create({ data: { marca, modelo, anoDe, anoAte, slug } })
  return NextResponse.json({ ...moto, produtos: 0 }, { status: 201 })
}
