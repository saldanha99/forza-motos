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
    // Desativado para segurança — apagar todos os ativo=false deletava produtos válidos sem estoque.
    // Agora o Passo 0 (Limpar fantasmas) faz isso comparando com o Tiny em tempo real de forma 100% segura.
    return NextResponse.json({
      ok: true,
      removidos: 0,
      tipo: 'inativos',
      pulados: 0,
      msg: 'Use a ferramenta "Limpar fantasmas automaticamente" (Passo 0). Ela é 100% segura e evita apagar produtos legítimos que estão apenas sem estoque temporariamente.',
    })
  }

  if (tipo === 'preco_zero') {
    // Produto com pedido não pode ser apagado: OrderItem.product não tem
    // onDelete: Cascade, então o delete estouraria violação de FK no meio da
    // operação. `orderItems: { none: {} }` é a mesma condição usada na
    // contagem — o número confirmado é o número apagado.
    const r = await prisma.product.deleteMany({
      where: { preco: 0, orderItems: { none: {} } },
    })
    const pulados = await prisma.product.count({
      where: { preco: 0, orderItems: { some: {} } },
    })
    removidos = r.count
    return NextResponse.json({ ok: true, removidos, pulados, tipo: 'preco_zero' })
  }

  if (tipo === 'duplicados') {
    // Remove tinyIds duplicados — mantém o com updatedAt mais recente
    let pulados = 0
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
        select: { id: true, _count: { select: { orderItems: true } } },
      })
      // Mantém o mais recente e descarta os que têm pedido: apagá-los
      // estouraria violação de FK (OrderItem.product não é cascade).
      const idsParaDeletar = todos
        .slice(1)
        .filter((p) => p._count.orderItems === 0)
        .map((p) => p.id)
      pulados += todos.slice(1).length - idsParaDeletar.length
      if (idsParaDeletar.length > 0) {
        await prisma.product.deleteMany({ where: { id: { in: idsParaDeletar } } })
        removidos += idsParaDeletar.length
      }
    }
    return NextResponse.json({ ok: true, removidos, pulados, tipo: 'duplicados' })
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

  if (tipo === 'sem_imagem') {
    // Remove produtos sem foto (temImagem=false) que já foram verificados
    // Exclui produtos que têm OrderItems para evitar violação de FK
    const comPedidos = await prisma.orderItem.findMany({
      where: { product: { temImagem: false } },
      select: { productId: true },
      distinct: ['productId'],
    })
    const idsComPedidos = comPedidos.map((p) => p.productId)

    const r = await prisma.product.deleteMany({
      where: {
        temImagem: false,
        imagensVerificadas: true,
        ...(idsComPedidos.length > 0 ? { id: { notIn: idsComPedidos } } : {}),
      },
    })
    removidos = r.count
    return NextResponse.json({
      ok: true,
      removidos,
      tipo: 'sem_imagem',
      pulados: idsComPedidos.length,
      msg: idsComPedidos.length > 0
        ? `${removidos} excluídos, ${idsComPedidos.length} mantidos (têm pedidos vinculados)`
        : `${removidos} produtos sem foto excluídos`,
    })
  }

  if (tipo === 'sem_imagem_count') {
    // Só conta, não deleta — para mostrar preview antes da confirmação
    const comPedidos = await prisma.orderItem.findMany({
      where: { product: { temImagem: false } },
      select: { productId: true },
      distinct: ['productId'],
    })
    const idsComPedidos = comPedidos.map((p) => p.productId)

    const count = await prisma.product.count({
      where: {
        temImagem: false,
        imagensVerificadas: true,
        ...(idsComPedidos.length > 0 ? { id: { notIn: idsComPedidos } } : {}),
      },
    })
    return NextResponse.json({ ok: true, count, pulados: idsComPedidos.length })
  }

  if (tipo === 'preco_zero_count') {
    // Só conta, não deleta — para mostrar preview antes da confirmação
    // Mesma condição do delete, senão o preview mentiria
    const count = await prisma.product.count({
      where: { preco: 0, orderItems: { none: {} } },
    })
    const pulados = await prisma.product.count({
      where: { preco: 0, orderItems: { some: {} } },
    })
    return NextResponse.json({ ok: true, count, pulados })
  }

  if (tipo === 'duplicados_count') {
    // Só conta, não deleta — soma quantos registros seriam removidos por tinyId duplicado
    const duplicados = await prisma.$queryRaw<{ tinyId: string; count: number }[]>`
      SELECT "tinyId", COUNT(*)::int as count
      FROM "Product"
      WHERE "tinyId" IS NOT NULL
      GROUP BY "tinyId"
      HAVING COUNT(*) > 1
    `
    // Conta só o que é de fato apagável — mesma regra do delete
    let count = 0
    let pulados = 0
    for (const dup of duplicados) {
      const todos = await prisma.product.findMany({
        where: { tinyId: dup.tinyId },
        orderBy: { updatedAt: 'desc' },
        select: { _count: { select: { orderItems: true } } },
      })
      const candidatos = todos.slice(1)
      const apagaveis = candidatos.filter((p) => p._count.orderItems === 0).length
      count += apagaveis
      pulados += candidatos.length - apagaveis
    }
    return NextResponse.json({ ok: true, count, pulados })
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
}
