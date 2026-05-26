import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { estatisticasIndexacao } from '@/lib/seo/indexing'

/**
 * GET /api/seo/stats?dias=7
 *
 * Retorna agregado de envios de indexação para dashboard do admin.
 * Resposta:
 *   [
 *     { provider: 'GOOGLE',   status: 'SUCESSO', _count: 142 },
 *     { provider: 'GOOGLE',   status: 'FALHA',   _count: 3 },
 *     { provider: 'INDEXNOW', status: 'SUCESSO', _count: 287 },
 *   ]
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dias = Number(new URL(req.url).searchParams.get('dias') || 7)
  const stats = await estatisticasIndexacao(dias)
  return NextResponse.json({ dias, stats })
}
