/**
 * GET /api/crm/queue — Processa fila de mensagens WhatsApp
 * Chamado pelo cron do Vercel a cada 5 minutos
 */

import { NextResponse } from 'next/server'
import { processarFila } from '@/lib/evolution/queue'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  // Segurança: aceita só chamadas do cron (header CRON_SECRET) ou admin
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resultado = await processarFila(20)
    console.log(`[crm/queue] Enviadas: ${resultado.enviadas}, Falhas: ${resultado.falhas}`)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (e: any) {
    console.error('[crm/queue]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
