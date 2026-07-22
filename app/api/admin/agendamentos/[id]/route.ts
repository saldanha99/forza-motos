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

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  await prisma.appointment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
