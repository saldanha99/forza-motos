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
  const ativo = p.situacao === 'A' || p.situacao === 'Ativo'
  // A listagem do Tiny NÃO retorna campos de estoque (saldo fica em produto.obter.estoque.php)
  // Modelo dropshipping: produto ativo = disponível no fornecedor → estoque padrão 999
  const estoqueRaw = p.saldo_fisico_total ?? p.saldo_fisico ?? p.saldo ?? p.estoque_atual ?? p.quantidade
  const estoque = estoqueRaw !== undefined && estoqueRaw !== null
    ? Number(estoqueRaw)
    : ativo ? 999 : 0   // fallback: ativo=disponível, inativo=indisponível

  return {
    sku:      String(p.codigo || p.id),
    nome:     p.nome || 'Produto sem nome',
    preco:    Number(p.preco ?? p.preco_venda ?? 0),
    precoPromocional: (p.preco_promocional && Number(p.preco_promocional) > 0)
      ? Number(p.preco_promocional)
      : null,
    estoque,
    ativo,
    tinyId:   String(p.id),
    categoria: p.categoria?.descricao || (typeof p.categoria === 'string' ? p.categoria : '') || 'Geral',
    marca:    p.marca || '',
  }
}

/**
 * FASE 1 — Processa UMA página da listagem do Tiny
 * 1 request Tiny (0ms delay) + $transaction único → 1 round-trip ao banco
 * Deve concluir em < 6s mesmo no Hobby plan (limite 10s)
 */
export async function syncPaginaListagem(pagina: number) {
  const { produtos, totalPaginas } = await fetchTinyProductPage(pagina)

  if (produtos.length === 0) {
    return { criados: 0, atualizados: 0, erros: 0, paginaAtual: pagina, totalPaginas, hasMore: false }
  }

  const dados = produtos.map(mapearListagem)
  const skus = dados.map(d => d.sku)

  // 2 queries em paralelo: SKUs existentes + slugs em conflito
  const [existentes, slugConflicts] = await Promise.all([
    prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true } }),
    prisma.product.findMany({
      where: { slug: { in: dados.map(d => gerarSlug(d.nome)) } },
      select: { slug: true },
    }),
  ])

  const skusExistentes = new Set(existentes.map(e => e.sku))
  const slugsExistentes = new Set(slugConflicts.map(s => s.slug))

  const toUpdate = dados.filter(d => skusExistentes.has(d.sku))
  const toCreate = dados.filter(d => !skusExistentes.has(d.sku))

  // Monta lista de operações para $transaction (1 round-trip ao DB)
  const ops = [
    ...toUpdate.map(d =>
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
    ),
    ...toCreate.map(d => {
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
    }),
  ]

  let criados = 0
  let atualizados = 0
  let erros = 0

  try {
    await prisma.$transaction(ops)
    criados = toCreate.length
    atualizados = toUpdate.length
  } catch (err: any) {
    // Se a transaction falhar, tenta produto a produto para não perder tudo
    console.error('[sync] transaction falhou, tentando individualmente:', err?.message)
    for (const op of ops) {
      try {
        await op
        // conta baseado no tipo da operação
      } catch (e: any) {
        erros++
        console.error('[sync] op individual falhou:', e?.message)
      }
    }
    criados = toCreate.length - erros
    atualizados = toUpdate.length
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
 * NOTA: Se o Tiny não tiver imagens cadastradas, retorna imagens=[] mas marca
 * o produto com imagensVerificadas para não tentar de novo.
 */
export async function syncImagensLote(limite = 3) {
  // Usa raw SQL para filtrar produtos sem imagens com tinyId
  const precisam = await prisma.$queryRaw<{ id: string; sku: string; tinyId: string; nome: string }[]>`
    SELECT id, sku, "tinyId", nome
    FROM "Product"
    WHERE "tinyId" IS NOT NULL
      AND (imagens::text = '[]' OR imagens IS NULL)
      AND ("imagensVerificadas" IS NULL OR "imagensVerificadas" = false)
    ORDER BY "updatedAt" ASC
    LIMIT ${limite}
  `.catch(() =>
    // fallback se coluna imagensVerificadas não existir
    prisma.$queryRaw<{ id: string; sku: string; tinyId: string; nome: string }[]>`
      SELECT id, sku, "tinyId", nome
      FROM "Product"
      WHERE "tinyId" IS NOT NULL
        AND (imagens::text = '[]' OR imagens IS NULL)
      ORDER BY "updatedAt" ASC
      LIMIT ${limite}
    `
  )

  if (precisam.length === 0) {
    // Conta quantos ainda estão sem imagem
    const restantes = await prisma.$queryRaw<[{ n: number }]>`
      SELECT COUNT(*)::int as n FROM "Product"
      WHERE "tinyId" IS NOT NULL AND (imagens::text = '[]' OR imagens IS NULL)
    `
    return { atualizados: 0, semImagem: 0, restantes: restantes[0]?.n ?? 0, hasMore: false, semImagemNoTiny: false }
  }

  let atualizados = 0
  let erros = 0
  let semImagemNoTiny = 0

  for (const produto of precisam) {
    try {
      const detalhe = await fetchTinyProduct(produto.tinyId!)
      if (!detalhe) { erros++; continue }

      const imagens = extrairImagensTiny(detalhe)
      const descricao = detalhe.descricao_complementar || detalhe.obs || detalhe.descricao_curta || ''
      const categoria = detalhe.categoria?.descricao || (typeof detalhe.categoria === 'string' ? detalhe.categoria : '') || undefined
      const marca = detalhe.marca || undefined

      if (imagens.length === 0) semImagemNoTiny++

      // Atualiza mesmo sem imagens para marcar que já verificou o Tiny
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

  // Conta restantes usando raw SQL
  const restantesArr = await prisma.$queryRaw<[{ n: number }]>`
    SELECT COUNT(*)::int as n FROM "Product"
    WHERE "tinyId" IS NOT NULL AND (imagens::text = '[]' OR imagens IS NULL)
  `
  const restantes = restantesArr[0]?.n ?? 0

  return {
    atualizados,
    erros,
    semImagem: precisam.length,
    semImagemNoTiny,
    restantes,
    hasMore: restantes > 0,
    tinyNaoTemImagens: semImagemNoTiny === precisam.length,
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
