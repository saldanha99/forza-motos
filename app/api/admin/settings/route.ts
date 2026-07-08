import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { setSetting } from '@/lib/settings'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// GET /api/admin/settings
// Retorna todas as configurações salvas. Protegido por sessão de admin.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rows = await prisma.setting.findMany()
    const config = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return NextResponse.json(config)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao carregar configurações' }, { status: 500 })
  }
}

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

