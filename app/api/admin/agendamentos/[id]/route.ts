import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { consumirReservasDoAgendamento, cancelarReservasDoAgendamento } from '@/lib/estoque/reserva'

export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()

  const agendamento = await prisma.appointment.update({
    where: { id: params.id },
    data: {
      nome: body.nome,
      telefone: body.telefone,
      servico: body.servico,
      motoModelo: body.motoModelo,
      dataPreferida: new Date(body.dataPreferida),
      horarioPreferido: body.horarioPreferido,
      notas: body.notas ?? null,
      status: body.status,
    },
  })

  // Ciclo de vida das reservas: serviço concluído consome; cancelado libera o estoque
  if (body.status === 'concluido') await consumirReservasDoAgendamento(params.id)
  else if (body.status === 'cancelado') await cancelarReservasDoAgendamento(params.id)

  return NextResponse.json(agendamento)
}

const STATUS_VALIDOS = ['pendente', 'confirmado', 'concluido', 'cancelado']

/** Muda só o status — usado pelo arraste do quadro Kanban. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const { status } = body

  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const agendamento = await prisma.appointment.update({
    where: { id: params.id },
    data: { status },
  })

  // Mesmo ciclo de vida de reservas que o PUT já aplica
  if (status === 'concluido') await consumirReservasDoAgendamento(params.id)
  else if (status === 'cancelado') await cancelarReservasDoAgendamento(params.id)

  return NextResponse.json(agendamento)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  await prisma.appointment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
