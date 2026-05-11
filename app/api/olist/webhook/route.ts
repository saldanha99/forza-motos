import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const STATUS_MAP: Record<string, string> = {
  new: 'CONFIRMADO',
  approved: 'CONFIRMADO',
  invoiced: 'SEPARANDO',
  shipped: 'ENVIADO',
  delivered: 'ENTREGUE',
  canceled: 'CANCELADO',
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.event === 'order.updated' && body.data?.id) {
      const olistId = String(body.data.id)
      const novoStatus = STATUS_MAP[body.data.status]

      if (!novoStatus) return NextResponse.json({ ok: true })

      const pedido = await prisma.order.findFirst({
        where: { olistOrderId: olistId },
      })

      if (!pedido) return NextResponse.json({ ok: true })

      await prisma.order.update({
        where: { id: pedido.id },
        data: {
          status: novoStatus as any,
          tracking: {
            create: {
              status: novoStatus,
              descricao: `Status atualizado pelo OLIST: ${body.data.status}`,
            },
          },
        },
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook OLIST erro:', e)
    return NextResponse.json({ ok: true })
  }
}
