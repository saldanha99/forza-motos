/**
 * Rota de Cron para sincronização automática de produtos do Tiny/OLIST
 *
 * Chamada automaticamente pelo Vercel Cron (configurado em vercel.json)
 * Frequência: a cada 6 horas
 *
 * Protegida por CRON_SECRET para evitar chamadas não autorizadas
 */

import { NextResponse } from 'next/server'
import { syncProdutosOlist } from '@/lib/olist/sync-products'

export async function GET(req: Request) {
  // Verifica secret para proteger o endpoint
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    console.log('[cron] Iniciando sync automático de produtos Tiny...')
    const result = await syncProdutosOlist()
    console.log('[cron] Sync concluído:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[cron] Erro no sync:', e)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
