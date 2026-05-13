/**
 * Sincronização Tiny ERP → banco local
 *
 * FASE 1 — syncPaginaListagem(): usa só a listagem, 1 request por página
 *   → Rápido, sem rate limit, atualiza nome/preço/estoque de todos os produtos
 *
 * FASE 2 — syncImagensLote(): busca imagens de até 3 produtos sem foto por vez
 *   → Chamado separadamente, delay 1.2s entre requests
 */

import { fetchTinyProductPage, fetchTinyProduct, fetchTinyProductEstoque, extrairImagensTiny } from './client'
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
 * Usa imagensVerificadas para não re-checar produtos já consultados sem foto no Tiny.
 */
export async function syncImagensLote(limite = 10) {
  // Prioridade 1: produtos sem imagem E ainda não verificados
  // Prioridade 2: produtos sem imagem mas já verificados (talvez tenham sido adicionadas fotos)
  const precisam = await prisma.$queryRaw<{ id: string; sku: string; tinyId: string; nome: string }[]>`
    SELECT id, sku, "tinyId", nome
    FROM "Product"
    WHERE "tinyId" IS NOT NULL
      AND (imagens::text = '[]' OR imagens IS NULL)
      AND "imagensVerificadas" = false
    ORDER BY "updatedAt" ASC
    LIMIT ${limite}
  `

  if (precisam.length === 0) {
    // Conta quantos ainda estão sem imagem (incluindo os já verificados)
    const [semImagem, naoVerificados] = await Promise.all([
      prisma.$queryRaw<[{ n: number }]>`
        SELECT COUNT(*)::int as n FROM "Product"
        WHERE "tinyId" IS NOT NULL AND (imagens::text = '[]' OR imagens IS NULL)
      `,
      prisma.$queryRaw<[{ n: number }]>`
        SELECT COUNT(*)::int as n FROM "Product"
        WHERE "tinyId" IS NOT NULL AND (imagens::text = '[]' OR imagens IS NULL) AND "imagensVerificadas" = false
      `,
    ])
    return {
      atualizados: 0,
      semImagem: 0,
      restantes: semImagem[0]?.n ?? 0,
      naoVerificados: naoVerificados[0]?.n ?? 0,
      hasMore: false,
      semImagemNoTiny: false,
    }
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

      // Sempre marca imagensVerificadas=true, mesmo sem fotos
      // Isso impede que o mesmo produto seja re-consultado em cada rodada
      await prisma.product.update({
        where: { id: produto.id },
        data: {
          imagens,
          imagensVerificadas: true,
          temImagem: imagens.length > 0,
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

  // Conta restantes ainda não verificados
  const [restantesArr, naoVerificadosArr] = await Promise.all([
    prisma.$queryRaw<[{ n: number }]>`
      SELECT COUNT(*)::int as n FROM "Product"
      WHERE "tinyId" IS NOT NULL AND (imagens::text = '[]' OR imagens IS NULL)
    `,
    prisma.$queryRaw<[{ n: number }]>`
      SELECT COUNT(*)::int as n FROM "Product"
      WHERE "tinyId" IS NOT NULL AND (imagens::text = '[]' OR imagens IS NULL) AND "imagensVerificadas" = false
    `,
  ])

  const restantes = restantesArr[0]?.n ?? 0
  const naoVerificados = naoVerificadosArr[0]?.n ?? 0

  return {
    atualizados,
    erros,
    semImagem: precisam.length,
    semImagemNoTiny,
    restantes,
    naoVerificados,
    hasMore: naoVerificados > 0,
    // Só sinaliza "Tiny sem fotos" quando TODOS do lote não tinham imagem
    // Isso é informativo, não para o processo
    tinyNaoTemImagens: semImagemNoTiny === precisam.length && precisam.length > 0,
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

/**
 * FASE 4 — Sincroniza estoque real de `limite` produtos por vez
 * Lógica:
 *   - Depósito "Loja" > 0 → estoque físico real
 *   - Depósitos dropship (Drop_EuroLaqui / F_drop) → 999 (disponível no fornecedor)
 *   - Produto inativo → 0
 * Prioridade: produtos com estoque=999 ainda não verificados (recém importados)
 */
export async function syncEstoqueLote(limite = 5) {
  // Prioridade: produtos que nunca tiveram estoque real verificado (999 = placeholder)
  // Depois: produtos com estoque 0 (podem ter sido reabastecidos)
  const produtos = await prisma.$queryRaw<{ id: string; tinyId: string; estoque: number }[]>`
    SELECT id, "tinyId", estoque FROM "Product"
    WHERE "tinyId" IS NOT NULL
    ORDER BY
      CASE WHEN estoque = 999 THEN 0 ELSE 1 END,  -- 999 (não verificado) vem primeiro
      estoque ASC,                                  -- depois os zerados
      "updatedAt" ASC                               -- mais antigos
    LIMIT ${limite}
  `

  if (produtos.length === 0) {
    return { atualizados: 0, erros: 0, pendentes: 0, total: 0, hasMore: false }
  }

  let atualizados = 0
  let erros = 0

  for (const produto of produtos) {
    const novoEstoque = await fetchTinyProductEstoque(produto.tinyId!)
    if (novoEstoque === -1) { erros++; continue }

    await prisma.product.update({
      where: { id: produto.id },
      data: { estoque: novoEstoque },
    })
    atualizados++
  }

  const [total, pendentes] = await Promise.all([
    prisma.product.count({ where: { tinyId: { not: null } } }),
    prisma.$queryRaw<[{ n: number }]>`
      SELECT COUNT(*)::int AS n FROM "Product" WHERE "tinyId" IS NOT NULL AND estoque = 999
    `.then(r => r[0]?.n ?? 0),
  ])

  return {
    atualizados,
    erros,
    pendentes,  // quantos ainda com 999 (placeholder, não verificados)
    total,
    hasMore: pendentes > 0,
  }
}

/**
 * Atualiza estoque de um produto único via webhook do Tiny
 */
export async function syncEstoqueProduto(tinyId: string | number): Promise<number> {
  const novoEstoque = await fetchTinyProductEstoque(tinyId)
  if (novoEstoque === -1) return -1

  await prisma.product.updateMany({
    where: { tinyId: String(tinyId) },
    data: { estoque: novoEstoque },
  })
  return novoEstoque
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
      data: { ...d, imagens, descricao, temImagem: imagens.length > 0 },
    })
    return 'atualizado'
  }

  let slug = gerarSlug(d.nome)
  const slugExists = await prisma.product.findUnique({ where: { slug } })
  if (slugExists) slug = `${slug}-${d.sku}`

  await prisma.product.create({
    data: { ...d, slug, imagens, descricao, temImagem: imagens.length > 0, compatibilidadeMotos: [] },
  })
  return 'criado'
}
