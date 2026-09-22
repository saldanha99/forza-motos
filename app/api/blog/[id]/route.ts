import { NextResponse } from 'next/server'
import { exigirAcesso } from '@/lib/admin/acesso'
import { prisma } from '@/lib/prisma'

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await exigirAcesso('blog'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json()
  const post = await prisma.blogPost.update({
    where: { id: params.id },
    data: body,
  })

  return NextResponse.json(post)
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!(await exigirAcesso('blog'))) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  await prisma.blogPost.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
