/**
 * Cron diário às 6h: sincroniza estoque e preços de todos os produtos
 * Usa apenas a listagem do Tiny (sem chamada individual por produto = sem rate limit)
 */

import { NextResponse } from 'next/server'
import { syncEstoquePrecos } from '@/lib/olist/sync-products'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    console.log('[cron] Iniciando sync diário de estoque e preços...')
    const result = await syncEstoquePrecos()
    console.log('[cron] Concluído:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[cron] Erro:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
