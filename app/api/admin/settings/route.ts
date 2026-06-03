import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setSetting } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// POST /api/admin/settings
// Body: { key: string, value: string }
// Salva uma configuração no banco. Protegido por sessão de admin.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { key, value } = body

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: '"key" obrigatório.' }, { status: 400 })
  }

  await setSetting(key, String(value ?? ''))
  return NextResponse.json({ ok: true, key, value })
}
