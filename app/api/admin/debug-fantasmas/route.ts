/**
 * Debug: compara SKUs do banco com o Tiny para entender por que fantasmas não são detectados
 * GET /api/admin/debug-fantasmas
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchTinyProductPage } from '@/lib/olist/client'

export const maxDuration = 60

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // 1. Busca página 1 do Tiny para ver a estrutura real
  const pag1 = await fetchTinyProductPage(1)
  const totalPaginasTiny = pag1.totalPaginas
  const amostraTiny = pag1.produtos.slice(0, 5).map((p: any) => ({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    situacao: p.situacao,
    skuCalculado: String(p.codigo || p.id || '').trim(),
  }))

  // 2. Amostra do banco: 10 produtos ativos com seus campos sku e tinyId
  const amostaBanco = await prisma.product.findMany({
    where: { ativo: true },
    select: { id: true, sku: true, tinyId: true, nome: true },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  // 3. Conta produtos sem sku E sem tinyId (invisíveis para comparação)
  const semSkuETinyId = await prisma.$queryRaw<[{ n: number }]>`
    SELECT COUNT(*)::int as n FROM "Product"
    WHERE ativo = true
      AND (sku IS NULL OR sku = '')
      AND ("tinyId" IS NULL OR "tinyId" = '')
  `.then(r => r[0]?.n ?? 0)

  // 4. Conta produtos com sku mas sem tinyId
  const comSkuSemTinyId = await prisma.$queryRaw<[{ n: number }]>`
    SELECT COUNT(*)::int as n FROM "Product"
    WHERE ativo = true
      AND sku IS NOT NULL AND sku != ''
      AND ("tinyId" IS NULL OR "tinyId" = '')
  `.then(r => r[0]?.n ?? 0)

  // 5. Pega os primeiros SKUs do banco que batem (ou não) com a pág 1 do Tiny
  const skusTiny1 = new Set(pag1.produtos.map((p: any) => String(p.codigo || p.id || '').trim()))
  const produtosBanco = await prisma.product.findMany({
    where: { ativo: true },
    select: { sku: true, tinyId: true, nome: true },
    take: 200,
  })

  let matchesPag1 = 0
  let semMatch = 0
  const exemplosSemMatch: any[] = []
  for (const p of produtosBanco) {
    const sku = (p.sku || p.tinyId || '').trim()
    if (!sku) continue
    if (skusTiny1.has(sku)) {
      matchesPag1++
    } else {
      semMatch++
      if (exemplosSemMatch.length < 5) {
        exemplosSemMatch.push({ sku: p.sku, tinyId: p.tinyId, nome: p.nome })
      }
    }
  }

  return NextResponse.json({
    tiny: {
      totalPaginas: totalPaginasTiny,
      produtosPorPagina: pag1.produtos.length,
      estimativaTotalProdutos: totalPaginasTiny * pag1.produtos.length,
      amostraPrimeiros5: amostraTiny,
    },
    banco: {
      totalAtivos: await prisma.product.count({ where: { ativo: true } }),
      semSkuETinyId,
      comSkuSemTinyId,
      amostaPrimeiros10: amostaBanco,
    },
    comparacao: {
      skusTinyPag1: skusTiny1.size,
      dos200Primeiros: {
        matchesPag1,
        semMatch,
        exemplosSemMatch,
      },
    },
  })
}
