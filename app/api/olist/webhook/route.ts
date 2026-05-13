/**
 * Webhook recebido do Tiny / OLIST
 *
 * Eventos tratados:
 * - produto.criado / produto.alterado → sincroniza o produto no banco
 * - order.updated → atualiza status do pedido
 *
 * Para registrar este webhook no Tiny:
 *   Menu → Configurações → API → Webhooks
 *   URL: https://forza-motos-app.vercel.app/api/olist/webhook
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncProdutoUnico, syncEstoqueProduto } from '@/lib/olist/sync-products'

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

      if (olistId && novoStatus) {
        const pedido = await prisma.order.findFirst({
          where: { olistOrderId: olistId },
        })

        if (pedido) {
          await prisma.order.update({
            where: { id: pedido.id },
            data: {
              status: novoStatus as any,
              tracking: {
                create: {
                  status: novoStatus,
                  descricao: `Status atualizado via webhook OLIST/Tiny: ${statusKey}`,
                },
              },
            },
          })
          console.log(`[webhook] Pedido ${olistId} → ${novoStatus}`)
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
