import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncProdutosOlist } from '@/lib/olist/sync-products'

export const maxDuration = 60 // segundos (máximo no plano Hobby)

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    // Suporte a paginação: { pagina: 1 } no body
    const body = await req.json().catch(() => ({}))
    const pagina = Number(body.pagina ?? 1)

    const result = await syncProdutosOlist(pagina, 15)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
