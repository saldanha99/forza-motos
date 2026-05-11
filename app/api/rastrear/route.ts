import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const numeroPedido = searchParams.get('pedido')

  if (!numeroPedido) {
    return NextResponse.json({ error: 'Número do pedido obrigatório' }, { status: 400 })
  }

  const pedido = await prisma.order.findUnique({
    where: { orderNumber: numeroPedido },
    include: {
      items: { include: { product: { select: { nome: true } } } },
      tracking: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  // Retorna dados sem expor info sensível do cliente
  return NextResponse.json({
    orderNumber: pedido.orderNumber,
    status: pedido.status,
    createdAt: pedido.createdAt,
    subtotal: Number(pedido.subtotal),
    frete: Number(pedido.frete),
    total: Number(pedido.total),
    enderecoEntrega: pedido.enderecoEntrega,
    items: pedido.items.map((i) => ({
      nome: i.product.nome,
      quantidade: i.quantidade,
      precoUnitario: Number(i.precoUnitario),
    })),
    tracking: pedido.tracking.map((t) => ({
      status: t.status,
      descricao: t.descricao,
      createdAt: t.createdAt,
    })),
  })
}
