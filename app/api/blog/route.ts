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

  const body = await req.json()
  const post = await prisma.blogPost.create({
    data: {
      ...body,
      slug: body.slug || gerarSlug(body.titulo),
    },
  })

  return NextResponse.json(post, { status: 201 })
}
