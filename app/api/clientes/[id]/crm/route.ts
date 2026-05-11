import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { etapaFunil, notas } = await req.json()

  const crm = await prisma.customerCRM.upsert({
    where: { userId: params.id },
    update: { etapaFunil, notas },
    create: { userId: params.id, etapaFunil, notas },
  })

  return NextResponse.json(crm)
}
