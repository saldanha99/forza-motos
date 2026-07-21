/** DELETE /api/admin/motos/[id] — remove a moto (e seus vínculos, por cascade) */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await prisma.moto.delete({ where: { id: params.id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
