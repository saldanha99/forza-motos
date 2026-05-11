import { olistFetch } from './client'
import { prisma } from '../prisma'
import { gerarSlug } from '../utils'

export async function syncProdutosOlist() {
  const data = await olistFetch('/products/?page_size=100')
  const produtos = data.results ?? []

  let criados = 0
  let atualizados = 0

  for (const p of produtos) {
    const slug = gerarSlug(p.name)

    await prisma.product.upsert({
      where: { sku: String(p.sku || p.id) },
      update: {
        nome: p.name,
        descricao: p.description ?? '',
        preco: p.price ?? 0,
        estoque: p.quantity ?? 0,
        categoria: p.category?.name ?? 'Geral',
        marca: p.brand?.name ?? '',
        imagens: p.images?.map((i: any) => i.url) ?? [],
        ativo: p.status === 'active',
      },
      create: {
        sku: String(p.sku || p.id),
        nome: p.name,
        slug: slug,
        descricao: p.description ?? '',
        preco: p.price ?? 0,
        estoque: p.quantity ?? 0,
        categoria: p.category?.name ?? 'Geral',
        marca: p.brand?.name ?? '',
        compatibilidadeMotos: [],
        imagens: p.images?.map((i: any) => i.url) ?? [],
      },
    }).then(() => criados++)
      .catch(() => atualizados++)
  }

  return { criados, atualizados, total: produtos.length }
}
