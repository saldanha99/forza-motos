/**
 * POST /api/upload — upload genérico do admin (eventos, blog, etc).
 * Grava no storage próprio da VPS (/imagens, servido pelo nginx via Traefik
 * em /imagens/...) — não usa mais o Vercel Blob (cota estourada em 07/2026).
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const IMG_DIR = process.env.IMG_DIR ?? '/imagens'
const IMG_BASE_URL = process.env.IMG_BASE_URL ?? 'https://www.forzamotos.com.br/imagens'

const EXT_PERMITIDAS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'])

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const pasta = String(formData.get('pasta') ?? 'uploads').replace(/[^a-z0-9-]/gi, '') || 'uploads'
  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  if (!EXT_PERMITIDAS.has(ext)) {
    return NextResponse.json({ error: 'Formato de imagem não suportado' }, { status: 400 })
  }

  const nome = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const dir = path.join(IMG_DIR, pasta)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, nome), Buffer.from(await file.arrayBuffer()))

  return NextResponse.json({ url: `${IMG_BASE_URL}/${pasta}/${nome}` })
}
