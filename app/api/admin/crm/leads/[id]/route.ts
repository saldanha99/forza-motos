import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LeadEtapa } from '@prisma/client'

export const dynamic = 'force-dynamic'

const ETAPAS_VALIDAS = Object.values(LeadEtapa)

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const { etapa } = body

  if (!etapa || !ETAPAS_VALIDAS.includes(etapa)) {
    return NextResponse.json({ error: 'Etapa inválida' }, { status: 400 })
  }

  const lead = await prisma.crmLead.findUnique({ where: { id: params.id } })
  if (!lead) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })
  }

  const atualizado = await prisma.crmLead.update({
    where: { id: params.id },
    data: { etapa },
  })

  return NextResponse.json(atualizado)
}
