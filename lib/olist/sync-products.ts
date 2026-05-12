/**
 * Sincronização de produtos Tiny ERP → banco local
 *
 * Estratégia para evitar rate limit:
 * 1. Usa dados da LISTAGEM para atualizar preço/estoque de produtos já existentes (1 req/página)
 * 2. Só chama produto.obter.php para produtos NOVOS (imagens + descrição completa)
 * 3. Delay automático de 600ms entre requests (no client)
 * 4. Processa em lotes de 20 para evitar timeout 504 no Vercel
 */

import { fetchAllTinyProducts, fetchTinyProduct } from './client'
import { prisma } from '../prisma'
import { gerarSlug } from '../utils'

/**
 * Extrai URLs de imagem do produto Tiny
 * O Tiny retorna imagens em produto.fotos.foto[] ou produto.imagens.imagem[]
 */
function extrairImagens(p: any): string[] {
  // Formato: { fotos: { foto: [...] } } ou { fotos: [...] }
  if (p.fotos) {
    const raw = p.fotos.foto ?? p.fotos
    const lista = Array.isArray(raw) ? raw : [raw]
    const urls = lista
      .map((f: any) => (typeof f === 'string' ? f : f?.url || f?.link || ''))
      .filter(Boolean)
    if (urls.length) return urls
  }

  // Formato: { imagens: { imagem: [...] } } ou { imagens: [...] }
  if (p.imagens) {
    const raw = p.imagens.imagem ?? p.imagens
    const lista = Array.isArray(raw) ? raw : [raw]
    const urls = lista
      .map((i: any) => (typeof i === 'string' ? i : i?.url || i?.link || ''))
      .filter(Boolean)
    if (urls.length) return urls
  }

  // Campos únicos de imagem
  if (p.foto && typeof p.foto === 'string') return [p.foto]
  if (p.imagem_principal && typeof p.imagem_principal === 'string') return [p.imagem_principal]

  return []
}

/**
 * Mapeia produto da LISTAGEM (dados resumidos) para atualização rápida
 * Disponível sem chamada extra: id, codigo, nome, preco, situacao, saldo
 */
function mapearListagem(p: any) {
  return {
    sku:    String(p.codigo || p.id),
    nome:   p.nome || 'Produto sem nome',
    preco:  Number(p.preco ?? p.preco_venda ?? 0),
    precoPromocional: p.preco_promocional && Number(p.preco_promocional) > 0
      ? Number(p.preco_promocional)
      : null,
    // Estoque: Tiny usa diferentes campos dependendo da versão
    estoque: Number(
      p.saldo_fisico_total ??
      p.saldo_fisico ??
      p.saldo ??
      p.estoque_atual ??
      p.quantidade ??
      0
    ),
    ativo: p.situacao === 'A' || p.situacao === 'Ativo',
    tinyId: String(p.id),
    categoria: p.categoria?.descricao || (typeof p.categoria === 'string' ? p.categoria : '') || p.secao || 'Geral',
    marca: p.marca || '',
  }
}

/**
 * Mapeia produto COMPLETO (do produto.obter.php) para criação de novo produto
 */
function mapearDetalhes(p: any) {
  const base = mapearListagem(p)
  return {
    ...base,
    descricao: p.descricao_complementar || p.obs || p.descricao_curta || '',
    imagens: extrairImagens(p),
    compatibilidadeMotos: p.compatibilidade ? [p.compatibilidade] : [],
  }
}

/**
 * Sincronização em lote com estratégia anti-rate-limit:
 * - Produtos existentes: atualiza preço/estoque/nome com dados da listagem (SEM chamada extra)
 * - Produtos novos: busca detalhes completos (1 chamada extra por produto novo)
 *
 * @param pagina - página de produtos a processar (1-based)
 * @param limite - produtos por lote
 */
export async function syncProdutosOlist(pagina = 1, limite = 20) {
  const listaProdutos = await fetchAllTinyProducts()
  const total = listaProdutos.length

  const inicio = (pagina - 1) * limite
  const lote = listaProdutos.slice(inicio, inicio + limite)
  const totalPaginas = Math.ceil(total / limite)

  let criados = 0
  let atualizados = 0
  let erros = 0

  for (const item of lote) {
    try {
      const dados = mapearListagem(item)

      const existing = await prisma.product.findUnique({ where: { sku: dados.sku } })

      if (existing) {
        // Produto já existe: atualiza com dados da listagem (sem chamada extra!)
        await prisma.product.update({
          where: { sku: dados.sku },
          data: {
            nome:             dados.nome,
            preco:            dados.preco,
            precoPromocional: dados.precoPromocional ?? undefined,
            estoque:          dados.estoque,
            ativo:            dados.ativo,
            tinyId:           dados.tinyId,
            categoria:        dados.categoria || existing.categoria,
            marca:            dados.marca || existing.marca,
          },
        })
        atualizados++
      } else {
        // Produto novo: busca detalhes completos (imagens, descrição)
        let detalhes: any = null
        try {
          detalhes = await fetchTinyProduct(item.id)
        } catch (e) {
          console.warn(`[sync] Detalhe indisponível para ${item.id}, usando listagem`)
        }

        const d = detalhes ? mapearDetalhes(detalhes) : { ...dados, descricao: '', imagens: [], compatibilidadeMotos: [] }

        let slug = gerarSlug(d.nome)
        const slugExists = await prisma.product.findUnique({ where: { slug } })
        if (slugExists) slug = `${slug}-${d.sku}`

        await prisma.product.create({ data: { ...d, slug } })
        criados++
      }
    } catch (err: any) {
      console.error(`[sync] Erro produto ${item.id}:`, err?.message)
      erros++
    }
  }

  return {
    criados,
    atualizados,
    erros,
    total,
    paginaAtual: pagina,
    totalPaginas,
    hasMore: pagina < totalPaginas,
  }
}

/**
 * Sincroniza um único produto pelo ID do Tiny (usado pelo webhook)
 */
export async function syncProdutoUnico(tinyId: string | number): Promise<'criado' | 'atualizado' | 'ignorado'> {
  let produtoTiny: any = null
  try {
    produtoTiny = await fetchTinyProduct(tinyId)
  } catch {
    return 'ignorado'
  }
  if (!produtoTiny) return 'ignorado'

  const dados = mapearDetalhes(produtoTiny)
  const existing = await prisma.product.findUnique({ where: { sku: dados.sku } })

  if (existing) {
    await prisma.product.update({
      where: { sku: dados.sku },
      data: {
        nome:             dados.nome,
        descricao:        dados.descricao,
        preco:            dados.preco,
        precoPromocional: dados.precoPromocional ?? undefined,
        estoque:          dados.estoque,
        categoria:        dados.categoria,
        marca:            dados.marca,
        imagens:          dados.imagens,
        ativo:            dados.ativo,
        tinyId:           dados.tinyId,
      },
    })
    return 'atualizado'
  }

  let slug = gerarSlug(dados.nome)
  const slugExists = await prisma.product.findUnique({ where: { slug } })
  if (slugExists) slug = `${slug}-${dados.sku}`

  await prisma.product.create({ data: { ...dados, slug } })
  return 'criado'
}

/**
 * Sync somente de estoque e preço — ultra rápido, usa apenas listagem
 * Ideal para o cron diário
 */
export async function syncEstoquePrecos() {
  const listaProdutos = await fetchAllTinyProducts()
  let atualizados = 0
  let erros = 0

  for (const item of listaProdutos) {
    try {
      const dados = mapearListagem(item)
      const existing = await prisma.product.findUnique({ where: { sku: dados.sku } })
      if (!existing) continue

      await prisma.product.update({
        where: { sku: dados.sku },
        data: {
          preco:            dados.preco,
          precoPromocional: dados.precoPromocional ?? undefined,
          estoque:          dados.estoque,
          ativo:            dados.ativo,
        },
      })
      atualizados++
    } catch {
      erros++
    }
  }

  return { atualizados, erros, total: listaProdutos.length }
}
