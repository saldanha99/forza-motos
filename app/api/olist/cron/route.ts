/**
 * Cron diário às 6h: sync delta de estoque e produtos alterados
 *
 * Usa as APIs de fila do Tiny (extensão "API para estoque em tempo real"):
 *   - lista.atualizacoes.estoque  → só produtos cujo estoque mudou
 *   - lista.atualizacoes.produtos → só produtos cujo preço/nome/situação mudou
 *
 * Muito mais rápido que varrer todas as 29 páginas.
 * Registros lidos são consumidos da fila automaticamente pelo Tiny.
 */

import { NextResponse } from 'next/server'
import { syncDeltaEstoque, syncDeltaProdutos } from '@/lib/olist/sync-products'
import { replicarPedidosPendentes } from '@/lib/olist/sync-orders'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    console.log('[cron] Iniciando sync delta (estoque + produtos alterados)...')

    const [estoque, produtos, pedidos] = await Promise.allSettled([
      syncDeltaEstoque(1),   // últimas 24h
      syncDeltaProdutos(1),
      replicarPedidosPendentes(20), // retry de pedidos pagos não replicados
    ])

    const result = {
      estoque:  estoque.status  === 'fulfilled' ? estoque.value  : { erro: (estoque  as any).reason?.message },
      produtos: produtos.status === 'fulfilled' ? produtos.value : { erro: (produtos as any).reason?.message },
      pedidos:  pedidos.status  === 'fulfilled' ? pedidos.value  : { erro: (pedidos  as any).reason?.message },
    }

    console.log('[cron] Concluído:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[cron] Erro:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
