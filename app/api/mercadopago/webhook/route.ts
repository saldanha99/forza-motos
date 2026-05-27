import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { replicarPedidoOlist } from '@/lib/olist/sync-orders'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'
import { verificarEstoqueTiny } from '@/lib/tiny/verificar-estoque'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { normalizarWhatsApp } from '@/lib/evolution/client'

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
        select: {
          id: true, status: true, olistOrderId: true, orderNumber: true,
          items: { select: { productId: true, quantidade: true } },
        },
      })
      if (!order) return NextResponse.json({ ok: true })

      // Já está em estado final — nada a fazer (idempotência)
      const statusFinais = ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE', 'CANCELADO']
      if (statusFinais.includes(order.status)) {
        return NextResponse.json({ ok: true, status: order.status })
      }

      // 1) Verificação final de estoque no Tiny antes de confirmar o pedido
      //    Garante que, mesmo que o produto tenha sido vendido no físico
      //    entre o checkout e o pagamento, não entregamos o que não temos.
      const verificacao = await verificarEstoqueTiny(
        order.items.map((i) => ({ productId: i.productId, quantidade: i.quantidade }))
      ).catch(() => ({ ok: true, esgotados: [] })) // em caso de falha na API, libera

      if (!verificacao.ok) {
        // Estoque insuficiente: cancela e solicita reembolso automático no MP
        const nomes = verificacao.esgotados.map((e) => e.nome).join(', ')
        console.warn(`[mp-webhook] ⚠️ Estoque insuficiente após pagamento — pedido ${order.orderNumber}: ${nomes}`)

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'CANCELADO',
            tracking: {
              create: {
                status: 'CANCELADO',
                descricao: `⚠️ Pedido cancelado automaticamente: produto(s) esgotado(s) no estoque físico após confirmação do pagamento. Estornando: ${nomes}. Entre em contato com o cliente.`,
              },
            },
          },
        })

        // Solicita reembolso total no Mercado Pago
        try {
          await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({}), // corpo vazio = reembolso total
          })
          console.log(`[mp-webhook] Reembolso solicitado para pagamento ${paymentId}`)
        } catch (e) {
          console.error('[mp-webhook] Falha ao solicitar reembolso:', e)
        }

        return NextResponse.json({ ok: true, status: 'cancelled_no_stock' })
      }

      // 2) Estoque OK — confirma o pedido
      const orderComUser = await prisma.order.update({
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
        include: { user: { select: { nome: true, telefone: true, email: true } } },
      })

      // Dispara WhatsApp de confirmação se o usuário tem telefone
      if (orderComUser.user?.telefone) {
        const wa = normalizarWhatsApp(orderComUser.user.telefone)
        const lead = await prisma.crmLead.findFirst({ where: { whatsapp: wa } })
        await enfileirarMensagem({
          whatsapp: wa,
          nome: orderComUser.user.nome ?? 'Cliente',
          tipo: 'PEDIDO_CONFIRMADO',
          leadId: lead?.id,
          userId: orderComUser.userId ?? undefined,
          payload: { numeroPedido: order.orderNumber },
        }).catch(() => {})
      }

      // 3) Replica no Olist — só se ainda não foi replicado (idempotência)
      if (!order.olistOrderId) {
        try {
          await replicarPedidoOlist(orderId)
          console.log(`[mp-webhook] Pedido ${order.orderNumber} replicado no Olist`)
        } catch (e) {
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
