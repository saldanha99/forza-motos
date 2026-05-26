import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { MODELOS_MOTOS } from '@/lib/motos-modelos'
import { buildSitemap, staticRoutes, dbRoutes } from '@/lib/seo/sitemap-builder'
import { SEO_CONFIG } from '@/lib/seo/config'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap([
    // Páginas estáticas principais
    staticRoutes([
      { path: '/', priority: 1.0, changeFrequency: 'daily' },
      { path: '/produtos', priority: 0.9, changeFrequency: 'daily' },
      { path: '/pneus', priority: 0.9, changeFrequency: 'weekly' },
      { path: '/oleos', priority: 0.9, changeFrequency: 'weekly' },
      { path: '/pastilhas', priority: 0.8, changeFrequency: 'weekly' },
      { path: '/servicos', priority: 0.9, changeFrequency: 'monthly' },
      { path: '/sobre', priority: 0.6, changeFrequency: 'monthly' },
      { path: '/blog', priority: 0.7, changeFrequency: 'weekly' },
      { path: '/glossario', priority: 0.7, changeFrequency: 'weekly' },
      { path: '/agendar', priority: 0.6, changeFrequency: 'monthly' },
      { path: '/rastrear', priority: 0.4, changeFrequency: 'monthly' },
    ]),

    // /pneus/[modelo] — long-tail SEO
    MODELOS_MOTOS.map((m) => ({
      url: `${SEO_CONFIG.siteUrl}/pneus/${m.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    // Produtos ativos com imagem
    dbRoutes({
      prefix: '/produtos',
      fetch: () =>
        prisma.product.findMany({
          where: { ativo: true, estoque: { gt: 0 }, temImagem: true },
          select: { slug: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
      priority: 0.8,
      changeFrequency: 'weekly',
    }),

    // Posts de blog
    dbRoutes({
      prefix: '/blog',
      fetch: () =>
        prisma.blogPost.findMany({
          where: { publicado: true },
          select: { slug: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
      priority: 0.6,
      changeFrequency: 'monthly',
    }),

    // Termos do glossário
    dbRoutes({
      prefix: '/glossario',
      fetch: () =>
        prisma.glossaryTerm.findMany({
          where: { publicado: true },
          select: { slug: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
      priority: 0.5,
      changeFrequency: 'monthly',
    }),
  ])
}
