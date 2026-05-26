import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { replicarPedidoOlist } from '@/lib/olist/sync-orders'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'

/**
 * Webhook do Mercado Pago.
 *
 * Eventos:
 *   - payment (status: approved | rejected | cancelled | pending)
 *
 * Quando approved:
 *   1. Atualiza Order.status = CONFIRMADO
 *   2. Replica o pedido no Olist (com idempotência — só se olistOrderId for null)
 *   3. Dispara re-indexação da página do pedido no Google
 *
 * Idempotência:
 *   - O MP pode reenviar o webhook (retry policy do MP)
 *   - Verificamos olistOrderId antes de replicar para evitar duplicação
 *   - Verificamos status atual antes de atualizar para evitar tracking duplicado
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true, ignored: body.type })
    }

    const paymentId = body.data?.id
    if (!paymentId) return NextResponse.json({ ok: true })

    // Consulta detalhes do pagamento no MP
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payment = await res.json()

    const orderId = payment.external_reference
    if (!orderId) return NextResponse.json({ ok: true })

    // ── PAGAMENTO APROVADO ─────────────────────────────────────────────────
    if (payment.status === 'approved') {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, olistOrderId: true, orderNumber: true },
      })
      if (!order) return NextResponse.json({ ok: true })

      // 1) Atualiza status — só se ainda não estiver confirmado (idempotência)
      if (order.status !== 'CONFIRMADO' && order.status !== 'SEPARANDO' && order.status !== 'ENVIADO' && order.status !== 'ENTREGUE') {
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
      }

      // 2) Replica no Olist — só se ainda não foi replicado (idempotência)
      if (!order.olistOrderId) {
        try {
          await replicarPedidoOlist(orderId)
          console.log(`[mp-webhook] Pedido ${order.orderNumber} replicado no Olist`)
        } catch (e) {
          // Não joga erro pro MP (que ia reenviar o webhook eternamente)
          // mas registra no tracking pra você ver no admin
          console.error('[mp-webhook] Falha ao replicar Olist:', e)
          await prisma.order.update({
            where: { id: orderId },
            data: {
              tracking: {
                create: {
                  status: 'CONFIRMADO',
                  descricao: `⚠️ Pagamento aprovado mas replicação no Olist falhou: ${String(e).slice(0, 200)}. Tentar novamente manualmente.`,
                },
              },
            },
          })
        }
      }

      return NextResponse.json({ ok: true, status: 'approved' })
    }

    // ── PAGAMENTO REJEITADO / CANCELADO ────────────────────────────────────
    if (payment.status === 'rejected' || payment.status === 'cancelled') {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true },
      })
      if (order && order.status !== 'CANCELADO') {
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

        // Sinaliza ao Google que a página do pedido (se publicada) não existe mais
        triggerIndexing(`${SEO_CONFIG.siteUrl}/pedidos/${orderId}`, {
          action: 'URL_DELETED',
          origem: 'mp-webhook-cancel',
        })
      }
    }

    return NextResponse.json({ ok: true, status: payment.status })
  } catch (e) {
    console.error('Webhook MP erro:', e)
    // Sempre 200 — MP fica retentando se receber não-200
    return NextResponse.json({ ok: true })
  }
}
