import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const agendamento = await prisma.appointment.update({
    where: { id: params.id },
    data: body.status !== undefined
      ? { status: body.status }
      : {
          nome: body.nome,
          telefone: body.telefone,
          servico: body.servico,
          motoModelo: body.motoModelo,
          dataPreferida: new Date(body.dataPreferida),
          horarioPreferido: body.horarioPreferido,
          notas: body.notas ?? null,
          status: body.status_update ?? undefined,
        },
  })

  return NextResponse.json(agendamento)
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  await prisma.appointment.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
