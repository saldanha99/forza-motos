/**
 * Limpa o banco de produtos:
 * - Remove produtos com preco = 0 E estoque = 0 (claramente inválidos)
 * - Remove produtos com tinyId duplicado (mantém o mais recente)
 * - Opção fullSync: compara todos os SKUs com o Tiny e remove os ausentes
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchTinyProductPage } from '@/lib/olist/client'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { tipo } = await req.json().catch(() => ({ tipo: 'basico' }))

  let removidos = 0

  if (tipo === 'inativos') {
    // Remove produtos marcados como ativo=false (fantasmas confirmados pelo sync de imagens)
    const r = await prisma.product.deleteMany({
      where: { ativo: false },
    })
    removidos = r.count
    return NextResponse.json({ ok: true, removidos, tipo: 'inativos' })
  }

  if (tipo === 'preco_zero') {
    // Remove produtos com preco=0 E sem estoque
    const r = await prisma.product.deleteMany({
      where: { preco: 0 },
    })
    removidos = r.count
    return NextResponse.json({ ok: true, removidos, tipo: 'preco_zero' })
  }

  if (tipo === 'duplicados') {
    // Remove tinyIds duplicados — mantém o com updatedAt mais recente
    const duplicados = await prisma.$queryRaw<{ tinyId: string; count: number }[]>`
      SELECT "tinyId", COUNT(*)::int as count
      FROM "Product"
      WHERE "tinyId" IS NOT NULL
      GROUP BY "tinyId"
      HAVING COUNT(*) > 1
    `

    for (const dup of duplicados) {
      const todos = await prisma.product.findMany({
        where: { tinyId: dup.tinyId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      // Mantém o primeiro (mais recente), deleta o restante
      const idsParaDeletar = todos.slice(1).map((p) => p.id)
      if (idsParaDeletar.length > 0) {
        await prisma.product.deleteMany({ where: { id: { in: idsParaDeletar } } })
        removidos += idsParaDeletar.length
      }
    }
    return NextResponse.json({ ok: true, removidos, tipo: 'duplicados' })
  }

  if (tipo === 'sync_tiny') {
    // Busca TODOS os SKUs do Tiny e remove do DB os que não existem mais lá
    // Atenção: pode demorar se tiver muitas páginas
    const skusTiny = new Set<string>()
    let pagina = 1
    let totalPaginas = 1

    while (pagina <= totalPaginas) {
      try {
        const { produtos, totalPaginas: tp } = await fetchTinyProductPage(pagina)
        totalPaginas = tp
        for (const p of produtos) {
          skusTiny.add(String(p.codigo || p.id))
        }
        pagina++
        if (pagina <= totalPaginas) await new Promise(r => setTimeout(r, 300))
      } catch {
        break
      }
    }

    if (skusTiny.size === 0) {
      return NextResponse.json({ error: 'Não foi possível buscar SKUs do Tiny' }, { status: 500 })
    }

    // Busca todos os SKUs do banco
    const todosBanco = await prisma.product.findMany({
      where: { tinyId: { not: null } },
      select: { id: true, sku: true },
    })

    const idsParaDeletar = todosBanco
      .filter((p) => !skusTiny.has(p.sku))
      .map((p) => p.id)

    if (idsParaDeletar.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: idsParaDeletar } } })
      removidos = idsParaDeletar.length
    }

    return NextResponse.json({
      ok: true,
      removidos,
      tipo: 'sync_tiny',
      skusTiny: skusTiny.size,
      totalBanco: todosBanco.length,
    })
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}
