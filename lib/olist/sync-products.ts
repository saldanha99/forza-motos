/**
 * Sincronização de produtos entre Tiny ERP (OLIST) e banco de dados local
 *
 * Fluxo:
 * 1. Busca todos os produtos ativos do Tiny via API (paginado)
 * 2. Para cada produto, busca detalhes completos
 * 3. Upsert no banco: cria se não existe (por SKU), atualiza se já existe
 */

import { fetchAllTinyProducts, fetchTinyProduct } from './client'
import { prisma } from '../prisma'
import { gerarSlug } from '../utils'

/**
 * Mapeia um produto do Tiny para o formato do nosso banco de dados
 */
function mapearProdutoTiny(p: any) {
  // SKU: preferir codigo, depois id
  const sku = String(p.codigo || p.id || `tiny-${p.id}`)
  const nome = p.nome || p.descricao || 'Produto sem nome'

  // Imagens: pode vir como array ou campo único
  let imagens: string[] = []
  if (p.imagens && Array.isArray(p.imagens)) {
    imagens = p.imagens
      .map((i: any) => (typeof i === 'string' ? i : i.url || i.link || ''))
      .filter(Boolean)
  } else if (p.imagem_principal) {
    imagens = [p.imagem_principal]
  } else if (p.imagem) {
    imagens = [p.imagem]
  }

  // Preço
  const preco = Number(p.preco ?? p.preco_venda ?? 0)
  const precoPromocional = p.preco_promocional ? Number(p.preco_promocional) : undefined

  // Estoque
  const estoque = Number(p.estoque_atual ?? p.saldo_fisico ?? p.saldo ?? 0)

  // Categoria
  const categoria = p.categoria?.descricao || p.categoria || p.secao || 'Geral'

  // Marca
  const marca = p.marca || ''

  // Status: A = Ativo
  const ativo = p.situacao === 'A' || p.situacao === 'Ativo' || p.situacao === undefined

  // Compatibilidade com motos (campo personalizado, se existir)
  const compatibilidadeMotos = p.compatibilidade
    ? [p.compatibilidade]
    : p.variacoes_compatibilidade ?? []

  return {
    sku,
    nome,
    descricao: p.descricao_complementar || p.obs || '',
    preco,
    precoPromocional,
    estoque,
    categoria,
    marca,
    compatibilidadeMotos,
    imagens,
    ativo,
  }
}

/**
 * Sincroniza um único produto pelo ID do Tiny
 * Usado pelo webhook quando um produto é criado/alterado
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
      },
    })
    return 'atualizado'
  }

  let slug = gerarSlug(dados.nome)
  const slugExists = await prisma.product.findUnique({ where: { slug } })
  if (slugExists) slug = `${slug}-${dados.sku}`

  await prisma.product.create({
    data: { ...dados, slug },
  })
  return 'criado'
}

/**
 * Sincronização completa: importa todos os produtos ativos do Tiny
 * Executada manualmente pelo admin ou via cron
 */
export async function syncProdutosOlist() {
  // Busca lista resumida de todos os produtos
  const listaProdutos = await fetchAllTinyProducts()

  let criados = 0
  let atualizados = 0
  let erros = 0

  for (const item of listaProdutos) {
    try {
      // Busca detalhes completos de cada produto
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
          },
        })
        atualizados++
      } else {
        let slug = gerarSlug(dados.nome)
        const slugExists = await prisma.product.findUnique({ where: { slug } })
        if (slugExists) slug = `${slug}-${dados.sku}`

        await prisma.product.create({
          data: { ...dados, slug },
        })
        criados++
      }
    } catch (err) {
      console.error(`Erro ao sync produto ${item.id}:`, err)
      erros++
    }
  }

  return { criados, atualizados, erros, total: listaProdutos.length }
}
