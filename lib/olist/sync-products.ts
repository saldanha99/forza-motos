/**
 * Sincronização de produtos entre Tiny ERP e banco de dados local
 *
 * Correções:
 * - Imagens: Tiny retorna produto.fotos.foto[] com campo "url"
 * - 504 timeout: sync em lotes de 10, retorna progresso parcial
 */

import { fetchAllTinyProducts, fetchTinyProduct } from './client'
import { prisma } from '../prisma'
import { gerarSlug } from '../utils'

/**
 * Extrai URLs de imagem do produto Tiny
 * A API do Tiny retorna imagens em produto.fotos.foto[] { url }
 * ou produto.imagens.imagem[] { url } dependendo da versão
 */
function extrairImagens(p: any): string[] {
  // Formato mais comum: produto.fotos = { foto: [...] } ou produto.fotos = [...]
  if (p.fotos) {
    const lista = Array.isArray(p.fotos) ? p.fotos : (p.fotos.foto ? (Array.isArray(p.fotos.foto) ? p.fotos.foto : [p.fotos.foto]) : [])
    const urls = lista.map((f: any) => f?.url || f?.link || (typeof f === 'string' ? f : '')).filter(Boolean)
    if (urls.length) return urls
  }

  // Formato alternativo: produto.imagens
  if (p.imagens) {
    const lista = Array.isArray(p.imagens) ? p.imagens : (p.imagens.imagem ? (Array.isArray(p.imagens.imagem) ? p.imagens.imagem : [p.imagens.imagem]) : [])
    const urls = lista.map((i: any) => i?.url || i?.link || (typeof i === 'string' ? i : '')).filter(Boolean)
    if (urls.length) return urls
  }

  // Campos diretos de imagem única
  if (p.foto) return [p.foto]
  if (p.imagem_principal) return [p.imagem_principal]
  if (p.imagem) return [p.imagem]

  return []
}

/**
 * Mapeia um produto do Tiny para o formato do banco local
 */
function mapearProdutoTiny(p: any) {
  const sku = String(p.codigo || p.id || `tiny-${p.id}`)
  const nome = p.nome || p.descricao || 'Produto sem nome'
  const imagens = extrairImagens(p)
  const preco = Number(p.preco ?? p.preco_venda ?? 0)
  const precoPromocional = p.preco_promocional && Number(p.preco_promocional) > 0 ? Number(p.preco_promocional) : undefined
  const estoque = Number(p.estoque_atual ?? p.saldo_fisico_total ?? p.saldo ?? 0)
  const categoria = p.categoria?.descricao || (typeof p.categoria === 'string' ? p.categoria : '') || p.secao || 'Geral'
  const marca = p.marca || ''
  const ativo = p.situacao === 'A' || p.situacao === 'Ativo' || p.ativo === true || p.situacao === undefined
  const tinyId = String(p.id || '')

  // Descrição: usa campo complementar ou observações
  const descricao = p.descricao_complementar || p.obs || p.descricao_curta || ''

  return { sku, nome, descricao, preco, precoPromocional, estoque, categoria, marca, imagens, ativo, tinyId }
}

/**
 * Sincroniza um único produto pelo ID do Tiny (usado pelo webhook)
 */
export async function syncProdutoUnico(tinyId: string | number): Promise<'criado' | 'atualizado' | 'ignorado'> {
  const produtoTiny = await fetchTinyProduct(tinyId)
  if (!produtoTiny) return 'ignorado'

  const dados = mapearProdutoTiny(produtoTiny)
  const existing = await prisma.product.findUnique({ where: { sku: dados.sku } })

  if (existing) {
    await prisma.product.update({
      where: { sku: dados.sku },
      data: {
        nome: dados.nome,
        descricao: dados.descricao,
        preco: dados.preco,
        precoPromocional: dados.precoPromocional,
        estoque: dados.estoque,
        categoria: dados.categoria,
        marca: dados.marca,
        imagens: dados.imagens,
        ativo: dados.ativo,
        tinyId: dados.tinyId,
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
 * Sincronização em lote — processa até `limite` produtos por chamada
 * para evitar timeout 504 no Vercel (limite de 10s no plano Hobby)
 *
 * @param pagina - qual página de produtos processar (1-based)
 * @param limite - quantos produtos processar nesta chamada
 */
export async function syncProdutosOlist(pagina = 1, limite = 15) {
  // Busca lista completa para saber o total
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
      const produtoCompleto = await fetchTinyProduct(item.id)
      if (!produtoCompleto) { erros++; continue }

      const dados = mapearProdutoTiny(produtoCompleto)
      const existing = await prisma.product.findUnique({ where: { sku: dados.sku } })

      if (existing) {
        await prisma.product.update({
          where: { sku: dados.sku },
          data: {
            nome: dados.nome,
            descricao: dados.descricao,
            preco: dados.preco,
            precoPromocional: dados.precoPromocional,
            estoque: dados.estoque,
            categoria: dados.categoria,
            marca: dados.marca,
            imagens: dados.imagens,
            ativo: dados.ativo,
            tinyId: dados.tinyId,
          },
        })
        atualizados++
      } else {
        let slug = gerarSlug(dados.nome)
        const slugExists = await prisma.product.findUnique({ where: { slug } })
        if (slugExists) slug = `${slug}-${dados.sku}`
        await prisma.product.create({ data: { ...dados, slug } })
        criados++
      }
    } catch (err) {
      console.error(`Erro ao sync produto ${item.id}:`, err)
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
