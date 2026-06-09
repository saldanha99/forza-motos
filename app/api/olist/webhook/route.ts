/**
 * Webhook recebido do Tiny / OLIST
 *
 * Eventos tratados:
 * - produto.criado / produto.alterado → sincroniza o produto no banco
 * - order.updated → atualiza status do pedido
 *
 * Para registrar este webhook no Tiny:
 *   Menu → Configurações → API → Webhooks
 *   URL: https://forzamotos.com.br/api/olist/webhook
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncProdutoUnico, syncEstoqueProduto } from '@/lib/olist/sync-products'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { normalizarWhatsApp } from '@/lib/evolution/client'

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
    // Proteção opcional por token na URL (?secret=...).
    // Configure OLIST_WEBHOOK_SECRET e cadastre a URL do webhook com ?secret=<valor>.
    const segredo = process.env.OLIST_WEBHOOK_SECRET
    if (segredo) {
      const url = new URL(req.url)
      if (url.searchParams.get('secret') !== segredo) {
        return NextResponse.json({ error: 'não autorizado' }, { status: 401 })
      }
    }

    // Tiny envia JSON ou form-encoded dependendo da configuração
    const contentType = req.headers.get('content-type') ?? ''
    let body: any

    if (contentType.includes('application/json')) {
      body = await req.json()
    } else {
      const text = await req.text()
      try {
        // Tiny às vezes envia JSON dentro de um campo "dados"
        const params = new URLSearchParams(text)
        const dados = params.get('dados')
        body = dados ? JSON.parse(dados) : Object.fromEntries(params)
      } catch {
        body = {}
      }
    }

    const evento = body.evento || body.event || ''
    const tipo = body.tipo || ''

    // ── Atualização de estoque ─────────────────────────────────────────────
    // Tiny dispara quando estoque muda no depósito
    if (
      evento === 'produto.estoque' ||
      evento === 'estoque.atualizado' ||
      evento === 'stock.updated' ||
      (tipo === 'produto' && body.dados?.estoque !== undefined) ||
      (tipo === 'estoque')
    ) {
      const id = body.dados?.id || body.data?.id || body.id
      if (id) {
        const novoEstoque = await syncEstoqueProduto(id)
        console.log(`[webhook] Estoque produto ${id} → ${novoEstoque}`)
      }
      return NextResponse.json({ ok: true })
    }

    // ── Produto criado ou alterado ──────────────────────────────────────────
    if (
      evento === 'produto.criado' ||
      evento === 'produto.alterado' ||
      tipo === 'produto' ||
      evento === 'product.created' ||
      evento === 'product.updated'
    ) {
      const id = body.dados?.id || body.data?.id || body.id
      if (id) {
        // Sincroniza dados completos (inclui estoque real)
        await syncProdutoUnico(id)
        // Também atualiza estoque via endpoint específico (mais preciso)
        await syncEstoqueProduto(id).catch(() => {})
        console.log(`[webhook] Produto ${id} sincronizado (${evento})`)
      }
      return NextResponse.json({ ok: true })
    }

    // ── Atualização de pedido ───────────────────────────────────────────────
    if (
      evento === 'order.updated' ||
      evento === 'pedido.atualizado' ||
      (tipo === 'pedido' && body.dados?.situacao)
    ) {
      const olistId = String(
        body.dados?.id || body.data?.id || body.id || ''
      )
      const statusKey = body.dados?.situacao || body.data?.status || ''
      const novoStatus = STATUS_MAP[statusKey]

      // Tenta capturar tracking code de várias estruturas possíveis do Tiny/Olist
      const trackingCode =
        body.dados?.codigo_rastreamento ||
        body.dados?.rastreamento?.codigo ||
        body.dados?.objeto_correios ||
        body.data?.tracking_code ||
        body.data?.tracking?.code ||
        null
      const transportadora =
        body.dados?.transportadora?.nome ||
        body.dados?.transportadora ||
        body.data?.shipping?.carrier ||
        null

      if (olistId && novoStatus) {
        const pedido = await prisma.order.findFirst({
          where: { olistOrderId: olistId },
          select: {
            id: true,
            status: true,
            trackingCode: true,
            freteTransportadora: true,
            orderNumber: true,
          },
        })

        if (pedido && (pedido.status !== novoStatus || (trackingCode && !pedido.trackingCode))) {
          const desc: string[] = [`Status atualizado via webhook OLIST/Tiny: ${statusKey}`]
          if (trackingCode && !pedido.trackingCode) {
            desc.push(`Código de rastreamento: ${trackingCode}`)
          }

          await prisma.order.update({
            where: { id: pedido.id },
            data: {
              status: novoStatus as any,
              // Salva tracking code se vier no payload e ainda não estiver setado
              ...(trackingCode && !pedido.trackingCode && { trackingCode: String(trackingCode) }),
              ...(transportadora && !pedido.freteTransportadora && {
                freteTransportadora: String(transportadora),
              }),
              tracking: {
                create: {
                  status: novoStatus,
                  descricao: desc.join(' | '),
                },
              },
            },
          })
          console.log(
            `[webhook] Pedido ${olistId} → ${novoStatus}` +
              (trackingCode ? ` (rastreio: ${trackingCode})` : '')
          )

          // Dispara WhatsApp com rastreio quando pedido é enviado
          if (novoStatus === 'ENVIADO' && trackingCode && pedido) {
            const orderFull = await prisma.order.findUnique({
              where: { id: pedido.id },
              include: { user: { select: { nome: true, telefone: true } } },
            })
            if (orderFull?.user?.telefone) {
              const wa = normalizarWhatsApp(orderFull.user.telefone)
              const lead = await prisma.crmLead.findFirst({ where: { whatsapp: wa } })
              await enfileirarMensagem({
                whatsapp: wa,
                nome: orderFull.user.nome ?? 'Cliente',
                tipo: 'PEDIDO_ENVIADO',
                leadId: lead?.id,
                userId: orderFull.userId ?? undefined,
                payload: {
                  numeroPedido: pedido.orderNumber,
                  rastreio: trackingCode,
                  transportadora: transportadora ?? 'Transportadora',
                },
              }).catch(() => {})
            }
          }
        }
      }
      return NextResponse.json({ ok: true })
    }

    // Evento desconhecido — retorna 200 para não reprocessar
    return NextResponse.json({ ok: true, evento_ignorado: evento })
  } catch (e) {
    console.error('[webhook] Erro:', e)
    return NextResponse.json({ ok: true }) // sempre 200 para o Tiny não retentar
  }
}
