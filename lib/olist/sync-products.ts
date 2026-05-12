/**
 * Sincronização Tiny ERP → banco local
 *
 * FASE 1 — syncPaginaListagem(): usa só a listagem, 1 request por página
 *   → Rápido, sem rate limit, atualiza nome/preço/estoque de todos os produtos
 *
 * FASE 2 — syncImagensLote(): busca imagens de até 3 produtos sem foto por vez
 *   → Chamado separadamente, delay 1.2s entre requests
 */

import { fetchTinyProductPage, fetchTinyProduct, extrairImagensTiny } from './client'
import { prisma } from '../prisma'
import { gerarSlug } from '../utils'

/** Mapeia dados resumidos da listagem */
function mapearListagem(p: any) {
  return {
    sku:      String(p.codigo || p.id),
    nome:     p.nome || 'Produto sem nome',
    preco:    Number(p.preco ?? p.preco_venda ?? 0),
    precoPromocional: (p.preco_promocional && Number(p.preco_promocional) > 0)
      ? Number(p.preco_promocional)
      : null,
    estoque:  Number(p.saldo_fisico_total ?? p.saldo_fisico ?? p.saldo ?? p.estoque_atual ?? p.quantidade ?? 0),
    ativo:    p.situacao === 'A' || p.situacao === 'Ativo',
    tinyId:   String(p.id),
    categoria: p.categoria?.descricao || (typeof p.categoria === 'string' ? p.categoria : '') || 'Geral',
    marca:    p.marca || '',
  }
}

/**
 * FASE 1 — Processa UMA página da listagem do Tiny
 * 1 request Tiny (sem delay) + operações DB em paralelo → bem abaixo de 10s
 * Cria produtos sem imagem; atualiza preço/estoque de existentes
 */
export async function syncPaginaListagem(pagina: number) {
  const { produtos, totalPaginas } = await fetchTinyProductPage(pagina)

  if (produtos.length === 0) {
    return { criados: 0, atualizados: 0, erros: 0, paginaAtual: pagina, totalPaginas, hasMore: false }
  }

  const dados = produtos.map(mapearListagem)
  const skus = dados.map(d => d.sku)

  // 1 query para saber quais SKUs já existem
  const existentes = await prisma.product.findMany({
    where: { sku: { in: skus } },
    select: { sku: true },
  })
  const skusExistentes = new Set(existentes.map(e => e.sku))

  // Verifica slugs existentes para novos produtos (em batch)
  const novos = dados.filter(d => !skusExistentes.has(d.sku))
  const slugsNovos = novos.map(d => gerarSlug(d.nome))
  const slugsExistentes = slugsNovos.length > 0
    ? await prisma.product.findMany({
        where: { slug: { in: slugsNovos } },
        select: { slug: true },
      }).then(r => new Set(r.map(s => s.slug)))
    : new Set<string>()

  let criados = 0
  let atualizados = 0
  let erros = 0

  // Atualiza existentes em paralelo (batches de 10)
  const existentesParaAtualizar = dados.filter(d => skusExistentes.has(d.sku))
  const updateResults = await Promise.allSettled(
    existentesParaAtualizar.map(d =>
      prisma.product.update({
        where: { sku: d.sku },
        data: {
          nome:             d.nome,
          preco:            d.preco,
          precoPromocional: d.precoPromocional ?? undefined,
          estoque:          d.estoque,
          ativo:            d.ativo,
          tinyId:           d.tinyId,
        },
      })
    )
  )
  for (const r of updateResults) {
    if (r.status === 'fulfilled') atualizados++
    else { erros++; console.error('[sync] update error:', r.reason?.message) }
  }

  // Cria novos em paralelo
  const createResults = await Promise.allSettled(
    novos.map(d => {
      let slug = gerarSlug(d.nome)
      if (slugsExistentes.has(slug)) slug = `${slug}-${d.sku}`
      return prisma.product.create({
        data: {
          sku:               d.sku,
          nome:              d.nome,
          slug,
          descricao:         '',
          preco:             d.preco,
          precoPromocional:  d.precoPromocional ?? undefined,
          estoque:           d.estoque,
          ativo:             d.ativo,
          tinyId:            d.tinyId,
          categoria:         d.categoria,
          marca:             d.marca,
          imagens:           [],
          compatibilidadeMotos: [],
        },
      })
    })
  )
  for (const r of createResults) {
    if (r.status === 'fulfilled') criados++
    else { erros++; console.error('[sync] create error:', r.reason?.message) }
  }

  return {
    criados,
    atualizados,
    erros,
    paginaAtual: pagina,
    totalPaginas,
    hasMore: pagina < totalPaginas,
  }
}

/**
 * FASE 2 — Busca imagens e descrição de até `limite` produtos que estão sem foto
 * Cada produto = 1 request ao Tiny (com delay 1.2s)
 */
export async function syncImagensLote(limite = 3) {
  // Busca produtos sem imagens (array vazio ou null)
  const semImagem = await prisma.product.findMany({
    where: {
      tinyId: { not: null },
      // imagens = '[]' ou vazio
    },
    select: { id: true, sku: true, tinyId: true, imagens: true, nome: true },
    take: limite * 3, // busca mais para filtrar
  })

  // Filtra os que realmente não têm imagens
  const precisam = semImagem
    .filter(p => {
      const imgs = Array.isArray(p.imagens) ? p.imagens : []
      return imgs.length === 0
    })
    .slice(0, limite)

  if (precisam.length === 0) {
    return { atualizados: 0, semImagem: 0, hasMore: false }
  }

  // Conta total sem imagem para saber se tem mais
  const totalSemImagem = await prisma.product.count({
    where: { tinyId: { not: null } },
  })

  let atualizados = 0
  let erros = 0

  for (const produto of precisam) {
    try {
      const detalhe = await fetchTinyProduct(produto.tinyId!)
      if (!detalhe) continue

      const imagens = extrairImagensTiny(detalhe)
      const descricao = detalhe.descricao_complementar || detalhe.obs || detalhe.descricao_curta || ''
      const categoria = detalhe.categoria?.descricao || (typeof detalhe.categoria === 'string' ? detalhe.categoria : '') || undefined
      const marca = detalhe.marca || undefined

      await prisma.product.update({
        where: { id: produto.id },
        data: {
          imagens,
          descricao: descricao || undefined,
          ...(categoria && { categoria }),
          ...(marca && { marca }),
        },
      })
      atualizados++
    } catch (err: any) {
      console.error(`[imagens] Erro ${produto.tinyId}:`, err?.message)
      erros++
    }
  }

  // Verifica se ainda tem mais sem imagem depois deste lote
  const aindasemImagem = await prisma.product.findMany({
    where: { tinyId: { not: null } },
    select: { imagens: true },
  })
  const restantes = aindasemImagem.filter(p => {
    const imgs = Array.isArray(p.imagens) ? p.imagens : []
    return imgs.length === 0
  }).length

  return {
    atualizados,
    erros,
    semImagem: totalSemImagem,
    restantes,
    hasMore: restantes > 0,
  }
}

/** Sync de estoque/preço para o cron diário — apenas listagem */
export async function syncEstoquePrecos() {
  let pagina = 1
  let totalPaginas = 1
  let atualizados = 0
  let erros = 0
  let total = 0

  while (pagina <= totalPaginas) {
    const { produtos, totalPaginas: tp } = await fetchTinyProductPage(pagina)
    totalPaginas = tp
    total += produtos.length

    for (const item of produtos) {
      try {
        const d = mapearListagem(item)
        const existing = await prisma.product.findUnique({ where: { sku: d.sku } })
        if (!existing) continue

        await prisma.product.update({
          where: { sku: d.sku },
          data: {
            preco:            d.preco,
            precoPromocional: d.precoPromocional ?? undefined,
            estoque:          d.estoque,
            ativo:            d.ativo,
          },
        })
        atualizados++
      } catch { erros++ }
    }
    pagina++
  }

  return { atualizados, erros, total }
}

/** Compat: mantém a assinatura antiga */
export async function syncProdutosOlist(pagina = 1, _limite = 20) {
  return syncPaginaListagem(pagina)
}

/** Sync produto único via webhook */
export async function syncProdutoUnico(tinyId: string | number): Promise<'criado' | 'atualizado' | 'ignorado'> {
  const detalhe = await fetchTinyProduct(tinyId).catch(() => null)
  if (!detalhe) return 'ignorado'

  const d = mapearListagem(detalhe)
  const imagens = extrairImagensTiny(detalhe)
  const descricao = detalhe.descricao_complementar || detalhe.obs || ''

  const existing = await prisma.product.findUnique({ where: { sku: d.sku } })

  if (existing) {
    await prisma.product.update({
      where: { sku: d.sku },
      data: { ...d, imagens, descricao },
    })
    return 'atualizado'
  }

  let slug = gerarSlug(d.nome)
  const slugExists = await prisma.product.findUnique({ where: { slug } })
  if (slugExists) slug = `${slug}-${d.sku}`

  await prisma.product.create({
    data: { ...d, slug, imagens, descricao, compatibilidadeMotos: [] },
  })
  return 'criado'
}
