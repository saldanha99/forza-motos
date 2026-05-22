import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const current = await prisma.product.findUnique({
    where: { id: params.id },
    select: { imagens: true, estoque: true, ativo: true }
  })

  if (!current) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  
  const rawImagens = body.imagens !== undefined ? body.imagens : current.imagens
  const imagens = Array.isArray(rawImagens) ? rawImagens : []
  const temImagem = imagens.length > 0
  
  const estoque = body.estoque !== undefined ? Number(body.estoque) : current.estoque
  
  const requestedAtivo = body.ativo !== undefined ? body.ativo : current.ativo
  const finalAtivo = requestedAtivo && temImagem && estoque > 0

  const produto = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...body,
      preco: body.preco !== undefined ? Number(body.preco) : undefined,
      precoPromocional: body.precoPromocional !== undefined
        ? (body.precoPromocional ? Number(body.precoPromocional) : null)
        : undefined,
      estoque,
      temImagem,
      ativo: finalAtivo,
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
