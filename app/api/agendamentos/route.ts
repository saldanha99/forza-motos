import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()

    const agendamento = await prisma.appointment.create({
      data: {
        userId: session?.user?.id,
        nome: body.nome,
        telefone: body.telefone,
        servico: body.servico,
        motoModelo: body.motoModelo,
        dataPreferida: new Date(body.dataPreferida),
        horarioPreferido: body.horarioPreferido,
        notas: body.notas,
      },
    })

    // Atualiza CRM como ORCAMENTO se for novo cliente
    if (session?.user?.id) {
      await prisma.customerCRM.upsert({
        where: { userId: session.user.id },
        update: { etapaFunil: 'ORCAMENTO' },
        create: { userId: session.user.id, etapaFunil: 'ORCAMENTO' },
      })
    }

    return NextResponse.json(agendamento, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
