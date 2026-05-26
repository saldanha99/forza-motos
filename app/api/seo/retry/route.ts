import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reenviarFalhas } from '@/lib/seo/indexing'

/**
 * POST /api/seo/retry
 *
 * Reenvia para Google + IndexNow todas as URLs que falharam nas últimas 24h
 * (com no máximo 3 tentativas anteriores). Útil quando o admin vê uma falha
 * no dashboard e quer forçar retry sem esperar o cron diário.
 *
 * Body (opcional): { limite?: number }   default 50
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const limite = Number(body.limite || 50)

  const resultado = await reenviarFalhas(limite)
  return NextResponse.json(resultado)
}
