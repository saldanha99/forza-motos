/** DELETE /api/admin/reservas/[id] — cancela uma reserva de estoque */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { cancelarReserva } from '@/lib/estoque/reserva'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await cancelarReserva(params.id)
  return NextResponse.json({ ok: true })
}
