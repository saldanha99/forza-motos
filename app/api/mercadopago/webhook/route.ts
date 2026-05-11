import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.type === 'payment') {
      const paymentId = body.data?.id
      if (!paymentId) return NextResponse.json({ ok: true })

      // Consulta pagamento no MP
      const token = process.env.MERCADOPAGO_ACCESS_TOKEN
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const payment = await res.json()

      const orderId = payment.external_reference
      if (!orderId) return NextResponse.json({ ok: true })

      if (payment.status === 'approved') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'CONFIRMADO',
            pagamentoMetodo: payment.payment_method_id,
            tracking: {
              create: {
                status: 'CONFIRMADO',
                descricao: `Pagamento aprovado via ${payment.payment_method_id}.`,
              },
            },
          },
        })
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'CANCELADO',
            tracking: {
              create: {
                status: 'CANCELADO',
                descricao: `Pagamento ${payment.status}.`,
              },
            },
          },
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook MP erro:', e)
    return NextResponse.json({ ok: true })
  }
}
