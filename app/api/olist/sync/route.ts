import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { syncProdutosOlist } from '@/lib/olist/sync-products'

export async function POST(_req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const result = await syncProdutosOlist()
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
