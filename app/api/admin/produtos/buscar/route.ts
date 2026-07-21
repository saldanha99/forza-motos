/**
 * GET /api/admin/produtos/buscar?q=... — busca de produtos para vincular a motos.
 * Retorna até 20 resultados (id, nome, sku, categoria).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const produtos = await prisma.product.findMany({
    where: {
      OR: [
        { nome: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { categoria: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, nome: true, sku: true, categoria: true },
    take: 20,
    orderBy: { ativo: 'desc' },
  })
  return NextResponse.json(produtos)
}
