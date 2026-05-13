import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

const BASE = 'https://forza-motos-app.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Páginas estáticas
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/produtos`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/agendar`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/rastrear`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]

  // Produtos ativos com estoque
  const produtos = await prisma.product.findMany({
    where: { ativo: true, estoque: { gt: 0 } },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => [])

  const produtosPages: MetadataRoute.Sitemap = produtos.map((p) => ({
    url: `${BASE}/produtos/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Posts do blog publicados
  const posts = await prisma.blogPost.findMany({
    where: { publicado: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => [])

  const blogPages: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...produtosPages, ...blogPages]
}
