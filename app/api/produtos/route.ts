import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarSlug } from '@/lib/utils'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const slug = body.slug || gerarSlug(body.nome)

    const produto = await prisma.product.create({
      data: {
        ...body,
        slug,
        preco: Number(body.preco),
        precoPromocional: body.precoPromocional ? Number(body.precoPromocional) : null,
        estoque: Number(body.estoque ?? 0),
        preVenda: Boolean(body.preVenda),
        prazoEntregaDias: body.prazoEntregaDias ? Number(body.prazoEntregaDias) : null,
        compatibilidadeMotos: body.compatibilidadeMotos ?? [],
        imagens: body.imagens ?? [],
      },
    })

    return NextResponse.json(produto, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
