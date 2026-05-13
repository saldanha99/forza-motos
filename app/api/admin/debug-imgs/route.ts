/**
 * Diagnóstico: mostra URLs de imagem armazenadas no banco
 * GET /api/admin/debug-imgs
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 15

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // Busca os primeiros 20 produtos com imagem
  const amostras = await prisma.product.findMany({
    where: { temImagem: true },
    select: { id: true, nome: true, imagens: true },
    take: 20,
  })

  // Extrai todas as URLs e conta duplicatas
  const urlCount: Record<string, number> = {}
  const detalhe = amostras.map((p) => {
    const imgs = Array.isArray(p.imagens) ? p.imagens as string[] : []
    const url0 = imgs[0] ?? null
    if (url0) urlCount[url0] = (urlCount[url0] ?? 0) + 1
    return { nome: p.nome, totalImagens: imgs.length, primeiraUrl: url0 }
  })

  // URLs mais repetidas (top 5)
  const topUrls = Object.entries(urlCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({ url, count }))

  const totalComImagem = await prisma.product.count({ where: { temImagem: true } })
  const urlsUnicas = Object.keys(urlCount).length

  return NextResponse.json({
    totalComImagem,
    urlsUnicasNaAmostra: urlsUnicas,
    alerta: urlsUnicas === 1
      ? '⚠️ TODOS com a mesma URL — imagem errada importada'
      : urlsUnicas < 5
        ? '⚠️ Poucas URLs únicas — provável imagem padrão/errada'
        : '✅ URLs variadas — parece correto',
    topUrlsMaisRepetidas: topUrls,
    amostra: detalhe,
  })
}
