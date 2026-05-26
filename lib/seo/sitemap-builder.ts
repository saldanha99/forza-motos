import type { MetadataRoute } from 'next'
import { SEO_CONFIG } from './config'

/**
 * Builder modular para sitemap.xml.
 *
 * Uso em app/sitemap.ts:
 *
 *   import { buildSitemap, staticRoutes, dbRoutes } from '@/lib/seo/sitemap-builder'
 *   import { prisma } from '@/lib/prisma'
 *
 *   export default async function sitemap() {
 *     return buildSitemap([
 *       staticRoutes([
 *         { path: '/', priority: 1.0, changeFrequency: 'daily' },
 *         { path: '/pneus', priority: 0.9, changeFrequency: 'weekly' },
 *       ]),
 *       dbRoutes({
 *         prefix: '/produtos',
 *         fetch: () => prisma.product.findMany({
 *           where: { ativo: true, temImagem: true },
 *           select: { slug: true, updatedAt: true },
 *         }),
 *         priority: 0.8,
 *         changeFrequency: 'weekly',
 *       }),
 *       dbRoutes({
 *         prefix: '/blog',
 *         fetch: () => prisma.blogPost.findMany({
 *           where: { publicado: true },
 *           select: { slug: true, updatedAt: true },
 *         }),
 *         priority: 0.6,
 *         changeFrequency: 'monthly',
 *       }),
 *       dbRoutes({
 *         prefix: '/glossario',
 *         fetch: () => prisma.glossaryTerm.findMany({
 *           where: { publicado: true },
 *           select: { slug: true, updatedAt: true },
 *         }),
 *         priority: 0.5,
 *         changeFrequency: 'monthly',
 *       }),
 *     ])
 *   }
 */

export type ChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

export interface StaticRoute {
  path: string
  priority?: number
  changeFrequency?: ChangeFreq
  lastModified?: Date
}

export interface DbRouteFetcher {
  prefix: string
  fetch: () => Promise<Array<{ slug: string; updatedAt?: Date }>>
  priority?: number
  changeFrequency?: ChangeFreq
}

export function staticRoutes(routes: StaticRoute[]): MetadataRoute.Sitemap {
  return routes.map((r) => ({
    url: `${SEO_CONFIG.siteUrl}${r.path}`,
    lastModified: r.lastModified || new Date(),
    changeFrequency: r.changeFrequency || 'monthly',
    priority: r.priority ?? 0.5,
  }))
}

export async function dbRoutes(input: DbRouteFetcher): Promise<MetadataRoute.Sitemap> {
  const rows = await input.fetch().catch(() => [])
  return rows.map((r) => ({
    url: `${SEO_CONFIG.siteUrl}${input.prefix}/${r.slug}`,
    lastModified: r.updatedAt || new Date(),
    changeFrequency: input.changeFrequency || 'weekly',
    priority: input.priority ?? 0.6,
  }))
}

export async function buildSitemap(
  parts: Array<MetadataRoute.Sitemap | Promise<MetadataRoute.Sitemap>>
): Promise<MetadataRoute.Sitemap> {
  const resolved = await Promise.all(parts)
  return resolved.flat()
}
