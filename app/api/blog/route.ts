import { NextResponse } from 'next/server'
import { exigirAcesso } from '@/lib/admin/acesso'
import { prisma } from '@/lib/prisma'
import { gerarSlug } from '@/lib/utils'

export async function POST(req: Request) {
  if (!(await exigirAcesso('blog'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const post = await prisma.blogPost.create({
    data: {
      ...body,
      slug: body.slug || gerarSlug(body.titulo),
    },
  })

  return NextResponse.json(post, { status: 201 })
}
