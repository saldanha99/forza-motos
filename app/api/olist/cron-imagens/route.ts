/**
 * Cron automático de imagens — roda a cada 5 minutos
 * Processa um lote de 20 produtos sem foto por vez
 * Quando todos tiverem imagem, não faz nada (operação idempotente)
 */
import { NextResponse } from 'next/server'
import { syncImagensLote } from '@/lib/olist/sync-products'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const result = await syncImagensLote(20)
    console.log('[cron-imagens]', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[cron-imagens] Erro:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
