/**
 * GET /api/crm/queue — Processa fila de mensagens WhatsApp
 * Chamado pelo cron do Vercel a cada 5 minutos
 */

import { NextResponse } from 'next/server'
import { processarFila } from '@/lib/evolution/queue'
import { garantirWebhookEvolution } from '@/lib/evolution/client'
import { processarFilaEmails } from '@/lib/email/queue'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(req: Request) {
  // Segurança: aceita só chamadas do cron (header CRON_SECRET)
  // Fail-closed: sem CRON_SECRET configurado, endpoint fica bloqueado
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [whatsapp, email, webhookEvolution] = await Promise.all([
      processarFila(),
      processarFilaEmails(10),
      garantirWebhookEvolution(),
    ])
    console.log(
      `[crm/queue] WhatsApp enviadas=${whatsapp.enviadas} falhas=${whatsapp.falhas}; ` +
      `e-mails enviados=${email.enviadas} falhas=${email.falhas}; ` +
      `webhook Evolution=${webhookEvolution ? 'ok' : 'não configurado'}`,
    )
    return NextResponse.json({ ok: true, whatsapp, email, webhookEvolution })
  } catch (e: any) {
    console.error('[crm/queue]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
