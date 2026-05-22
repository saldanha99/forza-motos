import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

/** PATCH { url: string } — salva URL externa ou do Blob */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })

  const current = await prisma.product.findUnique({
    where: { id: params.id },
    select: { estoque: true }
  })
  const estoque = current?.estoque ?? 0
  const ativo = estoque > 0

  const produto = await prisma.product.update({
    where: { id: params.id },
    data: {
      imagens: [url],
      temImagem: true,
      imagensVerificadas: true,
      ativo,
    },
    select: { id: true, imagens: true, temImagem: true, ativo: true },
  })

  return NextResponse.json(produto)
}

/** POST FormData(file) — faz upload para Vercel Blob e salva */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'jpg'
  const filename = `produtos/${params.id}-${Date.now()}.${ext}`

  const blob = await put(filename, file, { access: 'public' })

  const current = await prisma.product.findUnique({
    where: { id: params.id },
    select: { estoque: true }
  })
  const estoque = current?.estoque ?? 0
  const ativo = estoque > 0

  const produto = await prisma.product.update({
    where: { id: params.id },
    data: {
      imagens: [blob.url],
      temImagem: true,
      imagensVerificadas: true,
      ativo,
    },
    select: { id: true, imagens: true, temImagem: true, ativo: true },
  })

  return NextResponse.json({ ...produto, uploadUrl: blob.url })
}

/** DELETE — remove todas as imagens do produto */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  await prisma.product.update({
    where: { id: params.id },
    data: { imagens: [], temImagem: false, imagensVerificadas: false, ativo: false },
  })

  return NextResponse.json({ ok: true })
}
