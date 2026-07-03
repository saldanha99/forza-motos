/**
 * Sync delta — usa extensão "API para estoque em tempo real" do Tiny
 *
 * Consome duas filas:
 *   1. lista.atualizacoes.estoque  → atualiza estoque dos produtos que mudaram
 *   2. lista.atualizacoes.produtos → atualiza preço/nome/situação dos que mudaram
 *
 * Muito mais rápido que o sync completo (processa só o que mudou).
 * Registros lidos são removidos da fila automaticamente pelo Tiny.
 *
 * POST /api/olist/sync-delta
 *   body (opcional): { diasAtras: number }  — padrão: 2 dias
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncDeltaEstoque, syncDeltaProdutos } from '@/lib/olist/sync-products'

export const maxDuration = 60

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const diasAtras = Number(body.diasAtras ?? 2)

  const [estoque, produtos] = await Promise.allSettled([
    syncDeltaEstoque(diasAtras),
    syncDeltaProdutos(diasAtras),
  ])

  return NextResponse.json({
    ok: true,
    estoque:  estoque.status  === 'fulfilled' ? estoque.value  : { erro: (estoque  as any).reason?.message },
    produtos: produtos.status === 'fulfilled' ? produtos.value : { erro: (produtos as any).reason?.message },
  })
}

// Também aceita GET para ser chamado pelo cron
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  // Fail-closed: sem CRON_SECRET configurado, endpoint fica bloqueado
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const [estoque, produtos] = await Promise.allSettled([
    syncDeltaEstoque(1),   // cron: últimas 24h
    syncDeltaProdutos(1),
  ])

  return NextResponse.json({
    ok: true,
    estoque:  estoque.status  === 'fulfilled' ? estoque.value  : { erro: (estoque  as any).reason?.message },
    produtos: produtos.status === 'fulfilled' ? produtos.value : { erro: (produtos as any).reason?.message },
  })
}
