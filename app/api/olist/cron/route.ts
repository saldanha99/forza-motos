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
import { prisma } from '@/lib/prisma'
import { enviarMensagem } from '@/lib/evolution/client'

export const maxDuration = 60

/**
 * Vigia do worker da VPS: se o heartbeat parou há mais de 2h, avisa o admin.
 * (O worker não consegue avisar que caiu — este cron é o plano B.)
 */
async function vigiarWorker(): Promise<{ workerOk: boolean; avisado?: boolean }> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'sync_worker_status' } })
    if (!row) return { workerOk: false } // nunca rodou — nada a vigiar ainda
    const status = JSON.parse(row.value)
    const idadeMin = (Date.now() - new Date(status.heartbeat).getTime()) / 60000
    if (idadeMin <= 120) return { workerOk: true }

    const horas = Math.round(idadeMin / 60)
    await enviarMensagem({
      whatsapp: process.env.ADMIN_WHATSAPP ?? '5519974049445',
      mensagem:
        `🚨 *Robô de Sync PARADO — Forza Motos*\n\n` +
        `O robô da VPS não dá sinal há ~${horas}h. Estoque e fotos não estão sincronizando!\n\n` +
        `Reiniciar: entrar na VPS e rodar\n` +
        '`docker restart forza-worker`\n\n' +
        `Status: https://www.forzamotos.com.br/admin/sincronizacao`,
    })
    return { workerOk: false, avisado: true }
  } catch (e: any) {
    console.error('[cron] vigiarWorker:', e.message)
    return { workerOk: false }
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Fail-closed: sem CRON_SECRET configurado, endpoint fica bloqueado
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    console.log('[cron] Iniciando sync delta (estoque + produtos alterados)...')

    const [estoque, produtos, pedidos, vigia] = await Promise.allSettled([
      syncDeltaEstoque(2),   // 2 dias: margem p/ timezone e falha do cron anterior
      syncDeltaProdutos(2),
      replicarPedidosPendentes(20), // retry de pedidos pagos não replicados
      vigiarWorker(),        // alerta WhatsApp se o worker da VPS estiver morto
    ])

    const result = {
      estoque:  estoque.status  === 'fulfilled' ? estoque.value  : { erro: (estoque  as any).reason?.message },
      produtos: produtos.status === 'fulfilled' ? produtos.value : { erro: (produtos as any).reason?.message },
      pedidos:  pedidos.status  === 'fulfilled' ? pedidos.value  : { erro: (pedidos  as any).reason?.message },
      worker:   vigia.status    === 'fulfilled' ? vigia.value    : { erro: (vigia    as any).reason?.message },
    }

    console.log('[cron] Concluído:', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    console.error('[cron] Erro:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
