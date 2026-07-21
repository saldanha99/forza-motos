/**
 * GET /api/admin/motos/[id]/produtos — produtos vinculados à moto
 * PUT /api/admin/motos/[id]/produtos — define a lista de produtos vinculados
 *   body: { productIds: string[] }  (substitui os vínculos existentes)
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const vinculos = await prisma.produtoMoto.findMany({
    where: { motoId: params.id },
    include: { product: { select: { id: true, nome: true, sku: true, categoria: true } } },
  })
  return NextResponse.json(vinculos.map((v) => v.product))
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const productIds: string[] = Array.isArray(body.productIds) ? body.productIds.map(String) : []

  // Substitui o conjunto de vínculos da moto de forma atômica
  await prisma.$transaction([
    prisma.produtoMoto.deleteMany({ where: { motoId: params.id } }),
    prisma.produtoMoto.createMany({
      data: productIds.map((productId) => ({ motoId: params.id, productId })),
      skipDuplicates: true,
    }),
  ])

  return NextResponse.json({ ok: true, total: productIds.length })
}
