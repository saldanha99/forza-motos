import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { gerarSlug } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const eventos = await prisma.evento.findMany({
    orderBy: { dataInicio: 'asc' },
  })

  return NextResponse.json(eventos)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()

  const slug = body.slug || gerarSlug(body.titulo)

  const evento = await prisma.evento.create({
    data: {
      titulo: body.titulo,
      slug,
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

  return NextResponse.json(evento, { status: 201 })
}
