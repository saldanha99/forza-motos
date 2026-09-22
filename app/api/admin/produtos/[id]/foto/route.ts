import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

/**
 * Storage próprio da VPS (volume /imagens, servido pelo nginx via Traefik).
 * Mesma convenção do worker de sync: produtos/<sku>/<arquivo>.
 */
const IMG_DIR = process.env.IMG_DIR ?? '/imagens'
const IMG_BASE_URL = process.env.IMG_BASE_URL ?? 'https://www.forzamotos.com.br/imagens'

const EXT_PERMITIDAS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'])

/** PATCH { url: string } — salva URL externa já hospedada */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL obrigatória' }, { status: 400 })

  const current = await prisma.product.findUnique({
    where: { id: params.id },
    select: { estoque: true, preVenda: true, eventoPirelliId: true }
  })
  if (!current) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  if (current?.eventoPirelliId) {
    return NextResponse.json({
      error: 'Produto exclusivo do evento. Altere as imagens pela área Produtos do Evento Pirelli.',
    }, { status: 409 })
  }
  const estoque = current?.estoque ?? 0
  const ativo = Boolean(current?.preVenda) || estoque > 0

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

/** POST FormData(file) — grava no storage da VPS e salva a URL */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // Bloqueia antes de ler o arquivo e antes de gravar qualquer byte em disco.
  const current = await prisma.product.findUnique({
    where: { id: params.id },
    select: { sku: true, estoque: true, preVenda: true, eventoPirelliId: true },
  })
  if (!current) return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  if (current.eventoPirelliId) {
    return NextResponse.json({
      error: 'Produto exclusivo do evento. Altere as imagens pela área Produtos do Evento Pirelli.',
    }, { status: 409 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  if (!EXT_PERMITIDAS.has(ext)) {
    return NextResponse.json({ error: 'Formato de imagem não suportado' }, { status: 400 })
  }

  // O SKU vem do ERP e já é a pasta usada pelo worker de sync; o id do produto
  // é a saída para SKUs com caractere fora do conjunto seguro de diretório.
  const pasta = /^[A-Za-z0-9._-]+$/.test(current.sku) ? current.sku : params.id
  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  // Volume externo controlado; não é dependência do bundle.
  const dir = path.join(/* turbopackIgnore: true */ IMG_DIR, 'produtos', pasta)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, nome), Buffer.from(await file.arrayBuffer()))
  const url = `${IMG_BASE_URL}/produtos/${pasta}/${nome}`

  const estoque = current.estoque
  const ativo = current.preVenda || estoque > 0

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

  return NextResponse.json({ ...produto, uploadUrl: url })
}

/** DELETE — remove todas as imagens do produto */
export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const produto = await prisma.product.findUnique({
    where: { id: params.id },
    select: { eventoPirelliId: true },
  })
  if (produto?.eventoPirelliId) {
    return NextResponse.json({
      error: 'Produto exclusivo do evento. Altere as imagens pela área Produtos do Evento Pirelli.',
    }, { status: 409 })
  }

  await prisma.product.update({
    where: { id: params.id },
    data: { imagens: [], temImagem: false, imagensVerificadas: false, ativo: false },
  })

  return NextResponse.json({ ok: true })
}
