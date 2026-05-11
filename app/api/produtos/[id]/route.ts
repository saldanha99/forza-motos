import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const produto = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...body,
      preco: Number(body.preco),
      precoPromocional: body.precoPromocional ? Number(body.precoPromocional) : null,
      estoque: Number(body.estoque),
    },
  })

  return NextResponse.json(produto)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  await prisma.product.update({
    where: { id: params.id },
    data: { ativo: false },
  })

  return NextResponse.json({ ok: true })
}
