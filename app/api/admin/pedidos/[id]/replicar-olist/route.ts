/**
 * POST /api/admin/pedidos/{id}/replicar-olist
 *
 * Força a replicação de um pedido no Olist/Tiny (admin).
 * Útil quando a replicação automática (webhook do Mercado Pago) falhou.
 * Idempotente: se o pedido já tem olistOrderId, não duplica.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { replicarPedidoOlist } from '@/lib/olist/sync-orders'

export const maxDuration = 30

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { id: true, olistOrderId: true, orderNumber: true },
  })
  if (!order) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }
  if (order.olistOrderId) {
    return NextResponse.json({
      ok: true,
      jaReplicado: true,
      olistOrderId: order.olistOrderId,
    })
  }

  try {
    const result = await replicarPedidoOlist(order.id)
    const olistOrderId = (await prisma.order.findUnique({
      where: { id: order.id },
      select: { olistOrderId: true },
    }))?.olistOrderId

    await prisma.orderTracking.create({
      data: {
        orderId: order.id,
        status: 'CONFIRMADO',
        descricao: `Pedido replicado manualmente no Olist (ID ${olistOrderId}).`,
      },
    })

    return NextResponse.json({ ok: true, olistOrderId, retorno: result?.retorno?.status })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Falha ao replicar no Olist' },
      { status: 500 },
    )
  }
}
