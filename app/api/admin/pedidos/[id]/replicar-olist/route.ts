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
import { PedidoOlistIncertoError, replicarPedidoOlist } from '@/lib/olist/sync-orders'

export const maxDuration = 30

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    const body = await req.json().catch(() => ({})) as { confirmarNovaInclusao?: boolean }
    const result = await replicarPedidoOlist(order.id, {
      confirmarNovaInclusao: body.confirmarNovaInclusao === true,
    })
    if (result && 'processando' in result && result.processando) {
      return NextResponse.json(
        { ok: true, processando: true, mensagem: 'A replicação já está em andamento.' },
        { status: 202 },
      )
    }
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

    const retorno = result && 'retorno' in result ? result.retorno?.status : undefined
    return NextResponse.json({ ok: true, olistOrderId, retorno })
  } catch (e: any) {
    if (e instanceof PedidoOlistIncertoError) {
      return NextResponse.json(
        { error: e.message, requerConfirmacao: true },
        { status: 409 },
      )
    }
    return NextResponse.json(
      { error: e?.message || 'Falha ao replicar no Olist' },
      { status: 500 },
    )
  }
}
