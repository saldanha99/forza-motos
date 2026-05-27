/**
 * Sincronização Tiny ERP → banco local
 *
 * FASE 1 — syncPaginaListagem(): usa só a listagem, 1 request por página
 *   → Rápido, sem rate limit, atualiza nome/preço/estoque de todos os produtos
 *
 * FASE 2 — syncImagensLote(): busca imagens de até 3 produtos sem foto por vez
 *   → Chamado separadamente, delay 1.2s entre requests
 */

import { fetchTinyProductPage, fetchTinyProduct, fetchTinyProductEstoque, extrairImagensTiny, fetchTinyEstoqueDelta, fetchTinyProdutosDelta, dataDiasAtras } from './client'
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

  // Dimensões e peso (Tiny retorna em campos diferentes dependendo do endpoint)
  // peso_bruto vem em kg; dimensões em cm
  const peso = parseFloatOuNull(p.peso_bruto ?? p.peso_liquido ?? p.peso)
  const altura = parseFloatOuNull(p.altura_embalagem ?? p.altura)
  const largura = parseFloatOuNull(p.largura_embalagem ?? p.largura)
  const comprimento = parseFloatOuNull(p.comprimento_embalagem ?? p.comprimento)

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
    // Dimensões só são incluídas se vierem preenchidas (preserva valores antigos no banco)
    ...(peso !== null && { peso }),
    ...(altura !== null && { altura }),
    ...(largura !== null && { largura }),
    ...(comprimento !== null && { comprimento }),
  }
}

/** Parse seguro de número, retorna null se vazio/inválido/zero */
function parseFloatOuNull(v: any): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
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
    prisma.product.findMany({ where: { sku: { in: skus } }, select: { sku: true, temImagem: true } }),
    prisma.product.findMany({
      where: { slug: { in: dados.map(d => gerarSlug(d.nome)) } },
      select: { slug: true },
    }),
  ])

  const existentesMap = new Map(existentes.map(e => [e.sku, e.temImagem]))
  const slugsExistentes = new Set(slugConflicts.map(s => s.slug))

  const toUpdate = dados.filter(d => existentesMap.has(d.sku))
  const toCreate = dados.filter(d => !existentesMap.has(d.sku))

  // Monta lista de operações para $transaction (1 round-trip ao DB)
  const ops = [
    ...toUpdate.map(d => {
      const temImagem = existentesMap.get(d.sku) || false
      const ativo = d.ativo && temImagem && d.estoque > 0
      return prisma.product.update({
        where: { sku: d.sku },
        data: {
          nome:             d.nome,
          preco:            d.preco,
          precoPromocional: d.precoPromocional ?? undefined,
          estoque:          d.estoque,
          ativo:            ativo,
          tinyId:           d.tinyId,
        },
      })
    }),
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
          ativo:             false, // Novo produto não tem imagens ainda -> inativo por padrão
          tinyId:            d.tinyId,
          categoria:         d.categoria,
          marca:             d.marca,
          imagens:           [],
          temImagem:         false,
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
  // Prioridade 1: nunca verificados
  // Prioridade 2: verificados há mais de 7 dias e ainda sem foto (re-tentativa semanal)
  // Prioridade 1: nunca verificados (imagensVerificadas=false)
  // Prioridade 2: verificados há mais de 7 dias e ainda sem foto
  // Sem $queryRaw para compatibilidade com Neon Pooler
  const seteAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const naoVerif = await prisma.product.findMany({
    where: { tinyId: { not: null }, temImagem: false, imagensVerificadas: false },
    select: { id: true, sku: true, tinyId: true, nome: true, estoque: true },
    orderBy: { updatedAt: 'asc' },
    take: limite,
  })

  const restante = limite - naoVerif.length
  const recheck = restante > 0
    ? await prisma.product.findMany({
        where: {
          tinyId: { not: null },
          temImagem: false,
          imagensVerificadas: true,
          updatedAt: { lt: seteAtras },
        },
        select: { id: true, sku: true, tinyId: true, nome: true, estoque: true },
        orderBy: { updatedAt: 'asc' },
        take: restante,
      })
    : []

  const precisam = [...naoVerif, ...recheck]

  if (precisam.length === 0) {
    const [restantes, naoVerificados] = await Promise.all([
      prisma.product.count({ where: { tinyId: { not: null }, temImagem: false } }),
      prisma.product.count({ where: { tinyId: { not: null }, temImagem: false, imagensVerificadas: false } }),
    ])
    return {
      atualizados: 0,
      semImagem: 0,
      restantes,
      naoVerificados,
      hasMore: false,
      semImagemNoTiny: false,
    }
  }

  let atualizados = 0
  let erros = 0
  let semImagemNoTiny = 0
  let naoEncontradosNoTiny = 0

  for (const produto of precisam) {
    try {
      const detalhe = await fetchTinyProduct(produto.tinyId!)
      if (!detalhe) {
        // Produto não existe mais no Tiny → marca como verificado e inativo
        // para não poluir os próximos lotes
        await prisma.product.update({
          where: { id: produto.id },
          data: { imagensVerificadas: true, ativo: false },
        })
        naoEncontradosNoTiny++
        erros++
        continue
      }

      const imagens = extrairImagensTiny(detalhe)
      const temImagem = imagens.length > 0
      const tinyAtivo = detalhe.situacao === 'A' || detalhe.situacao === 'Ativo'
      const ativo = tinyAtivo && temImagem && produto.estoque > 0
      const descricao = detalhe.descricao_complementar || detalhe.obs || detalhe.descricao_curta || ''
      const categoria = detalhe.categoria?.descricao || (typeof detalhe.categoria === 'string' ? detalhe.categoria : '') || undefined
      const marca = detalhe.marca || undefined

      if (imagens.length === 0) semImagemNoTiny++

      await prisma.product.update({
        where: { id: produto.id },
        data: {
          imagens,
          // Marca como verificado sempre — evita loop infinito
          // Produtos sem foto no Tiny serão re-tentados semanalmente
          // pela condição: updatedAt < NOW() - INTERVAL '7 days'
          imagensVerificadas: true,
          temImagem,
          ativo,
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

  // Conta restantes ainda não verificados — sem $queryRaw
  const [restantes, naoVerificados] = await Promise.all([
    prisma.product.count({ where: { tinyId: { not: null }, temImagem: false } }),
    prisma.product.count({ where: { tinyId: { not: null }, temImagem: false, imagensVerificadas: false } }),
  ])

  return {
    atualizados,
    erros,
    semImagem: precisam.length,
    semImagemNoTiny,
    naoEncontradosNoTiny,
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

        const ativo = d.ativo && existing.temImagem && d.estoque > 0

        await prisma.product.update({
          where: { sku: d.sku },
          data: {
            preco:            d.preco,
            precoPromocional: d.precoPromocional ?? undefined,
            estoque:          d.estoque,
            ativo:            ativo,
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
  // Prioridade 1: produtos com estoque=999 (placeholder, nunca verificados)
  // Prioridade 2: produtos com estoque=0 (podem ter sido reabastecidos)
  // Sem $queryRaw para compatibilidade com Neon Pooler (pgBouncer transaction mode)

  const naoVerificados = await prisma.product.findMany({
    where: { tinyId: { not: null }, estoque: 999 },
    select: { id: true, tinyId: true, estoque: true },
    orderBy: { updatedAt: 'asc' },
    take: limite,
  })

  const restante = limite - naoVerificados.length
  const zerados = restante > 0
    ? await prisma.product.findMany({
        where: { tinyId: { not: null }, estoque: { lte: 0 } },
        select: { id: true, tinyId: true, estoque: true },
        orderBy: { updatedAt: 'asc' },
        take: restante,
      })
    : []

  const produtos = [...naoVerificados, ...zerados]

  if (produtos.length === 0) {
    return { atualizados: 0, erros: 0, pendentes: 0, total: 0, hasMore: false }
  }

  let atualizados = 0
  let erros = 0

  for (const produto of produtos) {
    const novoEstoque = await fetchTinyProductEstoque(produto.tinyId!)
    if (novoEstoque === -1) { erros++; continue }

    const productDb = await prisma.product.findUnique({
      where: { id: produto.id },
      select: { temImagem: true }
    })
    const temImagem = productDb?.temImagem || false
    const ativo = temImagem && novoEstoque > 0

    await prisma.product.update({
      where: { id: produto.id },
      data: { estoque: novoEstoque, ativo },
    })
    atualizados++
  }

  const [total, pendentes] = await Promise.all([
    prisma.product.count({ where: { tinyId: { not: null } } }),
    prisma.product.count({ where: { tinyId: { not: null }, estoque: 999 } }),
  ])

  return {
    atualizados,
    erros,
    pendentes,
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

  const products = await prisma.product.findMany({
    where: { tinyId: String(tinyId) },
    select: { id: true, temImagem: true }
  })

  for (const p of products) {
    const ativo = p.temImagem && novoEstoque > 0
    await prisma.product.update({
      where: { id: p.id },
      data: { estoque: novoEstoque, ativo },
    })
  }

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
  const temImagem = imagens.length > 0
  const descricao = detalhe.descricao_complementar || detalhe.obs || ''

  // Recalcular ativo: tinyAtivo && temImagem && estoque > 0
  const ativo = d.ativo && temImagem && d.estoque > 0

  const existing = await prisma.product.findUnique({ where: { sku: d.sku } })

  if (existing) {
    await prisma.product.update({
      where: { sku: d.sku },
      data: { ...d, imagens, descricao, temImagem, ativo },
    })
    return 'atualizado'
  }

  let slug = gerarSlug(d.nome)
  const slugExists = await prisma.product.findUnique({ where: { slug } })
  if (slugExists) slug = `${slug}-${d.sku}`

  await prisma.product.create({
    data: { ...d, slug, imagens, descricao, temImagem, ativo, compatibilidadeMotos: [] },
  })
  return 'criado'
}

// ─────────────────────────────────────────────────────────────────────────────
// DELTA SYNC — usa extensão "API para estoque em tempo real"
// Muito mais eficiente: processa apenas os produtos que realmente mudaram
// ─────────────────────────────────────────────────────────────────────────────

const DEPOSITOS_DROPSHIP = ['drop_eurolaqu', 'f_drop', 'eurolaqui', 'drop']

function calcularEstoqueDepositos(depositos: any[]): number {
  const lista: any[] = Array.isArray(depositos)
    ? depositos
    : (depositos as any)?.deposito
      ? [(depositos as any).deposito].flat()
      : []

  let saldoLoja = 0
  let temDropship = false

  for (const item of lista) {
    const dep = item.deposito ?? item
    const nome = (dep.nome ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const saldo = Number(dep.saldo ?? dep.quantidade ?? 0)
    if (nome === 'loja') {
      saldoLoja += saldo
    } else if (DEPOSITOS_DROPSHIP.some(d => nome.includes(d))) {
      temDropship = true
    }
  }

  if (saldoLoja > 0) return saldoLoja
  if (temDropship) return 999
  const total = lista.reduce((acc, item) => {
    const dep = item.deposito ?? item
    return acc + Number(dep.saldo ?? dep.quantidade ?? 0)
  }, 0)
  return Math.max(0, total)
}

/**
 * DELTA ESTOQUE — consome a fila de atualizações de estoque do Tiny
 * Atualiza somente os produtos cujo estoque mudou desde dataAlteracao.
 * Se não passar dataAlteracao, usa os últimos 2 dias.
 */
export async function syncDeltaEstoque(diasAtras = 2): Promise<{
  atualizados: number
  naoBanco: number
  paginas: number
}> {
  const dataAlteracao = dataDiasAtras(diasAtras)
  let pagina = 1
  let totalPaginas = 1
  let atualizados = 0
  let naoBanco = 0

  while (pagina <= totalPaginas) {
    const { produtos, totalPaginas: tp } = await fetchTinyEstoqueDelta(dataAlteracao, pagina)
    totalPaginas = tp

    for (const p of produtos) {
      const tinyId = String(p.id ?? '').trim()
      if (!tinyId) continue

      const depositos = p.depositos ?? []
      const estoque = depositos.length > 0
        ? calcularEstoqueDepositos(depositos)
        : Math.max(0, Number(p.saldo ?? 0))

      const existingProducts = await prisma.product.findMany({
        where: { tinyId },
        select: { id: true, temImagem: true }
      })

      if (existingProducts.length > 0) {
        for (const ep of existingProducts) {
          const ativo = ep.temImagem && estoque > 0
          await prisma.product.update({
            where: { id: ep.id },
            data: { estoque, ativo },
          })
          atualizados++
        }
      } else {
        naoBanco++
      }
    }

    if (pagina >= totalPaginas || produtos.length === 0) break
    pagina++
    await new Promise(r => setTimeout(r, 200))
  }

  return { atualizados, naoBanco, paginas: totalPaginas }
}

/**
 * DELTA PRODUTOS — consome a fila de produtos alterados do Tiny
 * Atualiza nome, preço e situação dos produtos que mudaram.
 * Cria o produto no banco se ainda não existir.
 * Se não passar diasAtras, usa os últimos 2 dias.
 */
export async function syncDeltaProdutos(diasAtras = 2): Promise<{
  atualizados: number
  criados: number
  naoBanco: number
  paginas: number
}> {
  const dataAlteracao = dataDiasAtras(diasAtras)
  let pagina = 1
  let totalPaginas = 1
  let atualizados = 0
  let criados = 0
  let naoBanco = 0

  while (pagina <= totalPaginas) {
    const { produtos, totalPaginas: tp } = await fetchTinyProdutosDelta(dataAlteracao, pagina)
    totalPaginas = tp

    for (const p of produtos) {
      const d = mapearListagem(p)
      if (!d.sku) { naoBanco++; continue }

      // Tenta localizar produto existente pelo sku ou tinyId para obter o temImagem
      let existing = await prisma.product.findUnique({
        where: { sku: d.sku },
        select: { id: true, temImagem: true }
      })

      if (!existing) {
        existing = await prisma.product.findFirst({
          where: { tinyId: d.tinyId },
          select: { id: true, temImagem: true }
        })
      }

      if (existing) {
        // Recalcula ativo: tinyAtivo && temImagem && estoque > 0
        const ativo = d.ativo && existing.temImagem && d.estoque > 0
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            nome: d.nome,
            preco: d.preco,
            precoPromocional: d.precoPromocional ?? undefined,
            ativo: ativo,
            tinyId: d.tinyId,
            categoria: d.categoria || undefined,
            marca: d.marca || undefined,
            estoque: d.estoque,
          },
        })
        atualizados++
      } else {
        // Produto novo — cria no banco (inativo por padrão até buscar fotos)
        try {
          let slug = gerarSlug(d.nome)
          const slugExists = await prisma.product.findUnique({ where: { slug } })
          if (slugExists) slug = `${slug}-${d.sku}`
          await prisma.product.create({
            data: {
              ...d,
              slug,
              descricao: '',
              imagens: [],
              temImagem: false,
              ativo: false,
              compatibilidadeMotos: [],
            },
          })
          criados++
        } catch {
          naoBanco++
        }
      }
    }

    if (pagina >= totalPaginas || produtos.length === 0) break
    pagina++
    await new Promise(r => setTimeout(r, 200))
  }

  return { atualizados, criados, naoBanco, paginas: totalPaginas }
}
