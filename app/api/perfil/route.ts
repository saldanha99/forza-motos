import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { nome, telefone, cpf } = await req.json()

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      nome:     nome?.trim()     || undefined,
      telefone: telefone?.trim() || undefined,
      cpf:      cpf?.trim()      || undefined,
    },
    select: { id: true, nome: true, email: true, telefone: true, cpf: true },
  })

  return NextResponse.json(user)
}
