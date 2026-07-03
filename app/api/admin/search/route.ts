/**
 * GET /api/admin/search?q=... — busca global do admin (⌘K)
 * Procura em produtos (nome/sku), pedidos (número) e clientes (nome/email).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) {
    return NextResponse.json({ produtos: [], pedidos: [], clientes: [] })
  }

  const [produtos, pedidos, clientes] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, nome: true, sku: true, estoque: true, ativo: true, slug: true },
      take: 6,
      orderBy: { ativo: 'desc' },
    }),
    prisma.order.findMany({
      where: { orderNumber: { contains: q, mode: 'insensitive' } },
      select: { id: true, orderNumber: true, status: true, total: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, nome: true, email: true },
      take: 5,
    }),
  ])

  return NextResponse.json({
    produtos: produtos.map((p) => ({ ...p, total: undefined })),
    pedidos: pedidos.map((p) => ({ ...p, total: Number(p.total) })),
    clientes,
  })
}
