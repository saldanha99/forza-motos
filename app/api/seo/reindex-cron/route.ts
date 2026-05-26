import { NextResponse } from 'next/server'
import { coletarURLsAtualizadas } from '@/lib/seo/collect-urls'
import { triggerIndexingBatch } from '@/lib/seo/indexing'

/**
 * GET /api/seo/reindex-cron
 *
 * Cron de SEGURANÇA — roda 1x por dia (recomendado 02:00 BRT = 05:00 UTC).
 *
 * Não substitui as notificações event-driven (que disparam no momento da
 * publicação). Serve como rede de segurança para:
 *   - URLs cuja notificação falhou silenciosamente
 *   - Conteúdo atualizado em massa via script/migration
 *   - "Refresh" dos hubs (homepage, /produtos, /blog, /glossario)
 *
 * Configure no vercel.json:
 *
 *   {
 *     "crons": [
 *       { "path": "/api/glossario/cron",      "schedule": "0 * * * *"  },
 *       { "path": "/api/seo/reindex-cron",    "schedule": "0 5 * * *"  }
 *     ]
 *   }
 *
 * Query params (opcionais):
 *   ?horas=24     janela de tempo a varrer (default: 24)
 *   ?limite=500   máximo de URLs a notificar (default: 500)
 */
export const maxDuration = 300 // 5min (precisa do plano Pro da Vercel para passar de 60s)

export async function GET(req: Request) {
  // Auth — Vercel envia `Authorization: Bearer ${CRON_SECRET}` automaticamente
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const horas = Number(url.searchParams.get('horas') || 24)
  const limite = Number(url.searchParams.get('limite') || 500)

  const desde = new Date(Date.now() - horas * 60 * 60 * 1000)
  const urls = await coletarURLsAtualizadas({ desde, limite })

  if (urls.length === 0) {
    return NextResponse.json({ ok: true, mensagem: 'Nenhuma URL para reindexar' })
  }

  const resultado = await triggerIndexingBatch(urls, {
    action: 'URL_UPDATED',
    origem: 'cron-reindex-diario',
  })

  return NextResponse.json({
    ok: true,
    urlsColetadas: urls.length,
    janela: `${horas}h`,
    desde: desde.toISOString(),
    enviadas: resultado.enviadas,
    falhas: resultado.falhas,
  })
}
