import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarSlug } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()

  const evento = await prisma.evento.update({
    where: { id: params.id },
    data: {
      titulo: body.titulo,
      slug: body.slug || gerarSlug(body.titulo),
      descricao: body.descricao,
      conteudo: body.conteudo ?? '',
      dataInicio: new Date(body.dataInicio),
      dataFim: body.dataFim ? new Date(body.dataFim) : null,
      local: body.local,
      endereco: body.endereco ?? null,
      imagemUrl: body.imagemUrl ?? null,
      preco: body.preco ?? 0,
      categoria: body.categoria ?? 'Evento',
      vagas: body.vagas ? Number(body.vagas) : null,
      linkExterno: body.linkExterno ?? null,
      ativo: body.ativo ?? true,
      publicado: body.publicado ?? false,
      destaque: body.destaque ?? false,
    },
  })

  return NextResponse.json(evento)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  await prisma.evento.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
