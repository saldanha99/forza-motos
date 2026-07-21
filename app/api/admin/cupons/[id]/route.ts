/**
 * PATCH  /api/admin/cupons/[id] — ativa/desativa ou edita um cupom
 * DELETE /api/admin/cupons/[id] — remove um cupom
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body.ativo === 'boolean') data.ativo = body.ativo
  if (body.descricao !== undefined) data.descricao = body.descricao?.trim() || null

  const cupom = await prisma.cupom.update({ where: { id: params.id }, data })
  return NextResponse.json(cupom)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await prisma.cupom.delete({ where: { id: params.id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
