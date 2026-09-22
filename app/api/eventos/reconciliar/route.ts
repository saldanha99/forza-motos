import { NextResponse } from 'next/server'
import { reconciliarPagamentosEventos } from '@/lib/eventos/reconciliacao'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Endpoint de cron: chamar a cada cinco minutos com Authorization Bearer. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resumo = await reconciliarPagamentosEventos()
    console.log('[eventos/reconciliar]', resumo)
    return NextResponse.json({ ok: true, ...resumo })
  } catch (error) {
    console.error('[eventos/reconciliar]', error)
    return NextResponse.json({ error: 'Falha ao reconciliar pagamentos de eventos.' }, { status: 500 })
  }
}
