import { NextResponse } from 'next/server'
import { processarJobsPendentes } from '@/lib/glossario/worker'

/**
 * GET /api/glossario/cron
 *
 * Endpoint protegido por CRON_SECRET. Processa até N jobs pendentes da fila.
 *
 * Agendado na crontab da VPS via /opt/forza/cron-forza.sh:
 *   {
 *     "crons": [
 *       { "path": "/api/glossario/cron", "schedule": "0 * * * *" }
 *     ]
 *   }
 *
 * O cron-forza.sh lê o CRON_SECRET do app.env e envia `Authorization: Bearer <CRON_SECRET>`.
 */
export const maxDuration = 60 // 1 minuto

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limite = Number(new URL(req.url).searchParams.get('limite') || 5)
  const resultado = await processarJobsPendentes(limite)
  return NextResponse.json(resultado)
}
