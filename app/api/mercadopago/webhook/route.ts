import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { replicarPedidoOlist } from '@/lib/olist/sync-orders'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'
import { verificarEstoqueTiny, restaurarEstoquePedido } from '@/lib/tiny/verificar-estoque'
import { validarAssinaturaMP } from '@/lib/mercadopago'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import { enviarEmailConfirmacao, enviarEmailIngresso } from '@/lib/email/send'

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

    // Suporte a dois formatos de webhook do MP:
    //   Novo: { type: 'payment', data: { id: '123' } }
    //   Antigo: { topic: 'payment', id: '123' }
    // Qualquer outro tipo (merchant_order, etc.) é ignorado.
    const isNewFormat  = body.type === 'payment'
    const isOldFormat  = body.topic === 'payment'
    if (!isNewFormat && !isOldFormat) {
      return NextResponse.json({ ok: true, ignored: body.type ?? body.topic })
    }

    const paymentId = isNewFormat ? body.data?.id : body.id
    if (!paymentId) return NextResponse.json({ ok: true })

    // Valida a assinatura HMAC do Mercado Pago (anti-spoofing/replay).
    // Se MERCADOPAGO_WEBHOOK_SECRET não estiver configurado, apenas registra
    // um aviso e segue (não quebra o fluxo enquanto o segredo não é setado).
    const assinaturaOk = validarAssinaturaMP({
      xSignature: req.headers.get('x-signature'),
      xRequestId: req.headers.get('x-request-id'),
      dataId: String(paymentId),
    })
    if (!assinaturaOk) {
      console.warn('[mp-webhook] Assinatura inválida — requisição rejeitada')
      return NextResponse.json({ error: 'assinatura inválida' }, { status: 401 })
    }

    // Consulta detalhes do pagamento no MP
    const token = process.env.MERCADOPAGO_ACCESS_TOKEN
    const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const payment = await res.json()

    const externalRef = payment.external_reference as string | undefined
    if (!externalRef) return NextResponse.json({ ok: true })

    // ── PAGAMENTO DE INGRESSO (external_reference = "evento_<inscricaoId>") ──
    if (externalRef.startsWith('evento_')) {
      const inscricaoId = externalRef.replace('evento_', '')

      if (payment.status === 'approved') {
        const inscricao = await prisma.eventoInscricao.findUnique({
          where: { id: inscricaoId },
          include: { evento: true },
        })
        if (!inscricao || inscricao.status === 'PAGO') {
          return NextResponse.json({ ok: true })
        }

        await prisma.eventoInscricao.update({
          where: { id: inscricaoId },
          data: { status: 'PAGO', mpPagamentoId: String(paymentId) },
        })

        const totalFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
          Number(inscricao.total),
        )
        const dataEvento = inscricao.evento.dataInicio
          ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(
              new Date(inscricao.evento.dataInicio),
            )
          : 'A confirmar'
        const localEvento = inscricao.evento.local ?? 'Campinas/SP'

        // E-mail de confirmação do ingresso
        await enviarEmailIngresso({
          para: inscricao.email,
          nomeCliente: inscricao.nome,
          tituloEvento: inscricao.evento.titulo,
          dataEvento,
          localEvento,
          quantidade: inscricao.quantidade,
          total: Number(inscricao.total),
        }).catch((e) => console.error('[mp-webhook] Falha ao enviar e-mail ingresso:', e))

        // WhatsApp para o lead
        const tel = inscricao.telefone
        if (tel) {
          const wa = normalizarWhatsApp(tel)
          await enfileirarMensagem({
            whatsapp: wa,
            nome: inscricao.nome,
            tipo: 'INGRESSO_CONFIRMADO',
            payload: {
              tituloEvento: inscricao.evento.titulo,
              quantidade: inscricao.quantidade,
              total: totalFmt,
            },
          }).catch(() => {})
        }

        // Notifica admin
        const adminPhone = process.env.ADMIN_WHATSAPP ?? '5519974049445'
        await enfileirarMensagem({
          whatsapp: adminPhone,
          nome: 'Admin',
          tipo: 'MANUAL',
          payload: {
            conteudo:
              `🎟️ *NOVO INGRESSO PAGO — Forza Motos*\n\n` +
              `🏁 Evento: ${inscricao.evento.titulo}\n` +
              `👤 Nome: ${inscricao.nome}\n` +
              `📧 E-mail: ${inscricao.email}\n` +
              `📱 Tel: ${inscricao.telefone}\n` +
              `🎟️ Ingressos: ${inscricao.quantidade}\n` +
              `💰 Total: ${totalFmt}`,
          },
        }).catch(() => {})
      }

      return NextResponse.json({ ok: true, tipo: 'evento', status: payment.status })
    }

    // ── PAGAMENTO DE PEDIDO (ecommerce) ───────────────────────────────────
    const orderId = externalRef

    // ── PAGAMENTO APROVADO ─────────────────────────────────────────────────
    if (payment.status === 'approved') {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true, status: true, olistOrderId: true, orderNumber: true, total: true,
          items: { select: { productId: true, quantidade: true, precoUnitario: true, product: { select: { nome: true } } } },
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
      // atualizarBanco:false → só checa disponibilidade; NÃO reverte a reserva
      // de estoque feita na criação do pedido (evita oversell — ver Fix #4).
      const verificacao = await verificarEstoqueTiny(
        order.items.map((i) => ({ productId: i.productId, quantidade: i.quantidade })),
        { atualizarBanco: false },
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
        include: {
          user: { select: { nome: true, telefone: true, email: true } },
        },
        // campos extras para e-mail
        // (subtotal, frete, total, freteTransportadora, fretePrazo, enderecoEntrega já existem no model)
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

      // 3) E-mail de confirmação para o cliente
      const emailCliente = orderComUser.user?.email ?? (orderComUser.enderecoEntrega as any)?.email
      if (emailCliente) {
        await enviarEmailConfirmacao({
          para: emailCliente,
          nomeCliente: orderComUser.user?.nome ?? 'Cliente',
          numeroPedido: order.orderNumber,
          itens: order.items.map((i: { product: { nome: string } | null; quantidade: number; precoUnitario: unknown }) => ({
            nome: i.product?.nome ?? 'Produto',
            quantidade: i.quantidade,
            precoUnitario: Number(i.precoUnitario),
          })),
          subtotal: Number(orderComUser.subtotal ?? 0),
          frete: Number(orderComUser.frete ?? 0),
          total: Number(orderComUser.total ?? 0),
          freteTransportadora: orderComUser.freteTransportadora,
          fretePrazo: orderComUser.fretePrazo,
        }).catch((e) => console.error('[mp-webhook] Falha ao enviar e-mail confirmação:', e))
      }

      // 4) Notifica admin via WhatsApp
      const adminPhone = process.env.ADMIN_WHATSAPP ?? '5519974049445'
      const itensTexto = order.items
        .map((i: { productId: string; quantidade: number; product: { nome: string } | null }) =>
          `  • ${i.product?.nome ?? i.productId} (${i.quantidade}x)`)
        .join('\n')
      const totalFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
        Number(orderComUser.total ?? 0),
      )
      await enfileirarMensagem({
        whatsapp: adminPhone,
        nome: 'Admin',
        tipo: 'MANUAL',
        payload: {
          conteudo:
            `🛒 *NOVO PEDIDO PAGO — Forza Motos*\n\n` +
            `📦 Pedido: ${order.orderNumber}\n` +
            `👤 Cliente: ${orderComUser.user?.nome ?? 'Guest'}\n` +
            `💳 Forma: ${payment.payment_method_id}\n` +
            `💰 Total: ${totalFmt}\n\n` +
            `Itens:\n${itensTexto}\n\n` +
            `✅ Replicado no Olist.\n` +
            `👉 Separar, embalar e despachar!`,
        },
      }).catch((e) => console.error('[mp-webhook] Falha ao notificar admin:', e))

      // 4) Replica no Olist — só se ainda não foi replicado (idempotência)
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
      // updateMany com WHERE condicional é atômico no banco:
      // se count=0, outra instância do webhook já cancelou → sem ação.
      // Evita race condition quando o MP dispara múltiplos retries simultâneos.
      const statusFinaisParaCancelar = ['CANCELADO', 'CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE']
      const atualizado = await prisma.order.updateMany({
        where: { id: orderId, status: { notIn: statusFinaisParaCancelar as any } },
        data: { status: 'CANCELADO' },
      })

      if (atualizado.count > 0) {
        // Esta instância "ganhou" o lock — restaura estoque e cria tracking
        const orderItens = await prisma.order.findUnique({
          where: { id: orderId },
          select: { items: { select: { productId: true, quantidade: true } } },
        })
        if (orderItens) {
          // Devolve ao estoque a reserva feita na criação do pedido.
          // O pedido nunca chegou ao Olist (replicação só em 'approved'),
          // então o saldo físico continua existindo — restaurar é seguro.
          await restaurarEstoquePedido(orderItens.items)

          await prisma.orderTracking.create({
            data: {
              orderId,
              status: 'CANCELADO',
              descricao: `Pagamento ${payment.status}. Estoque reservado devolvido.`,
            },
          })

          // Sinaliza ao Google que a página do pedido (se publicada) não existe mais
          triggerIndexing(`${SEO_CONFIG.siteUrl}/pedidos/${orderId}`, {
            action: 'URL_DELETED',
            origem: 'mp-webhook-cancel',
          })
        }
      }
    }

    return NextResponse.json({ ok: true, status: payment.status })
  } catch (e) {
    console.error('Webhook MP erro:', e)
    // Sempre 200 — MP fica retentando se receber não-200
    return NextResponse.json({ ok: true })
  }
}
