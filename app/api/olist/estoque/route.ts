/**
 * FASE 4 — Sync de estoque físico
 * Busca saldo real via produto.obter.estoque.php (5 produtos por vez)
 * Ideal para estoque físico da Forza lançado no Tiny
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncEstoqueLote } from '@/lib/olist/sync-products'

export const maxDuration = 60

export async function POST(_req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const result = await syncEstoqueLote(5)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
