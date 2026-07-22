/**
 * GET  /api/admin/agendamentos/[id]/reserva — reservas do agendamento
 * POST /api/admin/agendamentos/[id]/reserva — cria reserva { productId, quantidade }
 *   Retorna { conflito } quando as reservas passam do estoque (alerta já disparado no grupo).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { criarReserva, reservasAtivas } from '@/lib/estoque/reserva'

export const dynamic = 'force-dynamic'

async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  return session && session.user.role === 'ADMIN'
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const reservas = await prisma.reservaEstoque.findMany({
    where: { appointmentId: params.id, status: 'ATIVA' },
    include: { product: { select: { id: true, nome: true, estoque: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Anota disponibilidade de cada produto reservado
  const comDisponivel = await Promise.all(
    reservas.map(async (r) => ({
      id: r.id,
      quantidade: r.quantidade,
      produto: r.product,
      reservadoTotal: await reservasAtivas(r.productId),
    }))
  )
  return NextResponse.json(comDisponivel)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!(await exigirAdmin())) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const productId = String(body.productId ?? '')
  const quantidade = Math.max(1, Number(body.quantidade) || 1)
  if (!productId) return NextResponse.json({ error: 'Produto obrigatório' }, { status: 400 })

  const ag = await prisma.appointment.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!ag) return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })

  const { conflito } = await criarReserva(params.id, productId, quantidade)
  return NextResponse.json({ ok: true, conflito }, { status: 201 })
}
