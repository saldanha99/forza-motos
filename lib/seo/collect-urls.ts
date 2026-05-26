import { prisma } from '@/lib/prisma'
import { SEO_CONFIG } from './config'

/**
 * Coleta URLs de conteúdo que foram criadas/atualizadas no banco
 * dentro de uma janela de tempo (default: últimas 24h).
 *
 * Usado pelo cron de re-indexação (`/api/seo/reindex-cron`).
 *
 * Adapte os modelos abaixo se o seu projeto tiver mais tabelas indexáveis.
 * Para cada nova entidade, adicione uma seção `prisma.{model}.findMany(...)`.
 */

export interface CollectOptions {
  /** Buscar conteúdo modificado desde esta data */
  desde?: Date
  /** Limite total de URLs (Google = 200/dia, IndexNow = 10k/req) */
  limite?: number
}

export async function coletarURLsAtualizadas(
  options: CollectOptions = {}
): Promise<string[]> {
  const { desde = new Date(Date.now() - 24 * 60 * 60 * 1000), limite = 500 } = options
  const urls: string[] = []
  const base = SEO_CONFIG.siteUrl

  // ===== Produtos =====
  // Adapte o `where` conforme o schema do seu projeto
  const produtos = await prisma.product
    .findMany({
      where: { ativo: true, temImagem: true, updatedAt: { gte: desde } },
      select: { slug: true },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limite, 200),
    })
    .catch(() => [])
  for (const p of produtos) urls.push(`${base}/produtos/${p.slug}`)

  // ===== Posts do blog =====
  const posts = await prisma.blogPost
    .findMany({
      where: { publicado: true, updatedAt: { gte: desde } },
      select: { slug: true },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limite, 100),
    })
    .catch(() => [])
  for (const p of posts) urls.push(`${base}/blog/${p.slug}`)

  // ===== Termos do glossário =====
  const termos = await prisma.glossaryTerm
    .findMany({
      where: { publicado: true, updatedAt: { gte: desde } },
      select: { slug: true },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(limite, 200),
    })
    .catch(() => [])
  for (const t of termos) urls.push(`${base}/glossario/${t.slug}`)

  // Sempre inclui as páginas-índice (refresh dos hubs)
  urls.push(
    `${base}/`,
    `${base}/produtos`,
    `${base}/blog`,
    `${base}/glossario`,
    `${base}/sitemap.xml`
  )

  // Deduplica e respeita o limite total
  return Array.from(new Set(urls)).slice(0, limite)
}
