/**
 * Busca imagens de produtos sem foto (3 por vez)
 * Separado do sync principal para evitar rate limit e timeout
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncImagensLote } from '@/lib/olist/sync-products'

export const maxDuration = 60

export async function POST(_req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const result = await syncImagensLote(20)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
