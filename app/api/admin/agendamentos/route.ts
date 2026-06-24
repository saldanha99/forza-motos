import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()

  const agendamento = await prisma.appointment.create({
    data: {
      nome: body.nome,
      telefone: body.telefone,
      servico: body.servico,
      motoModelo: body.motoModelo,
      dataPreferida: new Date(body.dataPreferida),
      horarioPreferido: body.horarioPreferido,
      notas: body.notas ?? null,
      status: body.status ?? 'confirmado',
    },
  })

  return NextResponse.json(agendamento, { status: 201 })
}
