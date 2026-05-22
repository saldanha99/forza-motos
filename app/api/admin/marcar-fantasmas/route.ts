/**
 * Marca produtos fantasmas em blocos — sem timeout.
 * Cada chamada processa um bloco de páginas do Tiny (ex: páginas 1-5),
 * acumula os SKUs encontrados, e na chamada final marca no banco os ausentes.
 *
 * Fluxo do frontend:
 *   1. POST { fase: 'coletar', pagina: 1 }  → retorna { skus: [...], totalPaginas, done: false }
 *   2. POST { fase: 'coletar', pagina: 6 }  → retorna { skus: [...], totalPaginas, done: false }
 *   3. ...
 *   4. Quando done = true → POST { fase: 'marcar', skusTiny: [...] }
 *   5. Depois → chamar /api/admin/cleanup-produtos com tipo=inativos para deletar
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { fetchTinyProductPage } from '@/lib/olist/client'

const PAGINAS_POR_BLOCO = 5

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { fase, pagina = 1, skusTiny = [] } = body

  // ── Fase 1: coletar SKUs do Tiny em blocos ────────────────────────────────
  if (fase === 'coletar') {
    const skusBloco: string[] = []
    let totalPaginas = 1
    const paginaFim = pagina + PAGINAS_POR_BLOCO - 1

    for (let p = pagina; p <= paginaFim; p++) {
      try {
        const { produtos, totalPaginas: tp } = await fetchTinyProductPage(p)
        totalPaginas = tp

        for (const prod of produtos) {
          const sku = String(prod.codigo || prod.id || '').trim()
          if (sku) skusBloco.push(sku)
        }

        if (p >= totalPaginas) {
          return NextResponse.json({
            skus: skusBloco,
            totalPaginas,
            proximaPagina: null,
            done: true,
          })
        }

        // Delay entre páginas para não sobrecarregar a API do Tiny
        if (p < paginaFim && p < totalPaginas) {
          await new Promise(r => setTimeout(r, 250))
        }
      } catch (err: any) {
        return NextResponse.json({ error: `Erro na página ${p}: ${err.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({
      skus: skusBloco,
      totalPaginas,
      proximaPagina: paginaFim + 1,
      done: false,
    })
  }

  // ── Fase 2: marcar e limpar fantasmas no banco ─────────────────────────────
  if (fase === 'marcar') {
    if (!Array.isArray(skusTiny) || skusTiny.length === 0) {
      return NextResponse.json({ error: 'Lista de SKUs vazia' }, { status: 400 })
    }

    const skuSet = new Set<string>(skusTiny.map(String))

    // Busca todos os produtos do banco que têm tinyId (ativos e inativos)
    const todosBanco = await prisma.product.findMany({
      where: { tinyId: { not: null } },
      select: { id: true, sku: true, tinyId: true, nome: true, ativo: true },
    })

    const fantasmas = todosBanco.filter(p => {
      const sku = (p.sku || p.tinyId || '').trim()
      return sku && !skuSet.has(sku)
    })

    if (fantasmas.length === 0) {
      return NextResponse.json({
        ok: true,
        marcados: 0,
        deletados: 0,
        totalBanco: todosBanco.length,
        totalTiny: skuSet.size,
        msg: 'Nenhum fantasma encontrado — banco está sincronizado com o Tiny!',
      })
    }

    const idsFantasma = fantasmas.map(p => p.id)

    // Busca IDs de fantasmas que têm pedidos vinculados
    const comPedidos = await prisma.orderItem.findMany({
      where: { productId: { in: idsFantasma } },
      select: { productId: true },
      distinct: ['productId'],
    })
    const idsComPedidos = new Set(comPedidos.map(p => p.productId))

    const paraDeletar = idsFantasma.filter(id => !idsComPedidos.has(id))
    const paraInativar = idsFantasma.filter(id => idsComPedidos.has(id))

    let deletadosCount = 0
    let inativadosCount = 0

    // Deleta os fantasmas sem pedidos
    if (paraDeletar.length > 0) {
      const r = await prisma.product.deleteMany({
        where: { id: { in: paraDeletar } },
      })
      deletadosCount = r.count
    }

    // Inativa os fantasmas com pedidos
    if (paraInativar.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: paraInativar } },
        data: { ativo: false },
      })
      inativadosCount = paraInativar.length
    }

    return NextResponse.json({
      ok: true,
      marcados: inativadosCount,
      deletados: deletadosCount,
      totalBanco: todosBanco.length,
      totalTiny: skuSet.size,
      msg: `${deletadosCount} fantasmas excluídos com sucesso. ${inativadosCount} fantasmas com pedidos vinculados foram desativados.`,
    })
  }

  return NextResponse.json({ error: 'Fase inválida. Use "coletar" ou "marcar".' }, { status: 400 })
}
