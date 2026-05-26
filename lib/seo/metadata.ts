import type { Metadata } from 'next'
import { SEO_CONFIG } from './config'

/**
 * Builder de Metadata para Next.js 14+ App Router.
 *
 * Uso em qualquer page.tsx ou layout.tsx:
 *
 *   export const metadata = buildMetadata({
 *     title: 'Pneus para Moto',
 *     description: 'Os melhores pneus para sua moto...',
 *     path: '/pneus',
 *     image: '/og-pneus.jpg',
 *     keywords: ['pneu de moto', 'pneu honda'],
 *   })
 *
 * Para pages dinâmicas use `generateMetadata`:
 *
 *   export async function generateMetadata({ params }): Promise<Metadata> {
 *     const product = await getProduct(params.slug)
 *     return buildMetadata({
 *       title: product.nome,
 *       description: product.descricao,
 *       path: `/produtos/${product.slug}`,
 *       image: product.imagens[0],
 *       type: 'product',
 *     })
 *   }
 */
export interface BuildMetadataInput {
  title?: string
  description?: string
  /** Path relativo (ex: "/pneus") — será concatenado com siteUrl para canonical/og */
  path?: string
  /** URL da imagem (relativa ou absoluta). Idealmente 1200x630 */
  image?: string | null
  /** Palavras-chave separadas para meta keywords (Google ignora, mas Bing usa) */
  keywords?: string[] | string
  /** Tipo da página para OG */
  type?: 'website' | 'article' | 'product'
  /** Bloquear indexação desta página específica */
  noindex?: boolean
  /** Bloquear seguir links */
  nofollow?: boolean
  /** Para artigos: data de publicação ISO */
  publishedTime?: string
  /** Para artigos: data de modificação ISO */
  modifiedTime?: string
  /** Para artigos: nome do autor */
  author?: string
  /** Override do canonical (raramente necessário) */
  canonical?: string
  /** Locale alternativo (hreflang). Ex: { 'en-US': '/en/produtos' } */
  alternates?: Record<string, string>
}

export function buildMetadata(input: BuildMetadataInput = {}): Metadata {
  const {
    title,
    description = SEO_CONFIG.defaultDescription,
    path = '/',
    image,
    keywords,
    type = 'website',
    noindex = false,
    nofollow = false,
    publishedTime,
    modifiedTime,
    author,
    canonical,
    alternates,
  } = input

  const fullTitle = title
    ? `${title} | ${SEO_CONFIG.siteName}`
    : SEO_CONFIG.defaultTitle

  const url = `${SEO_CONFIG.siteUrl}${path}`
  const finalCanonical = canonical || url

  const ogImage = image
    ? image.startsWith('http')
      ? image
      : `${SEO_CONFIG.siteUrl}${image}`
    : `${SEO_CONFIG.siteUrl}${SEO_CONFIG.ogImage}`

  const meta: Metadata = {
    metadataBase: new URL(SEO_CONFIG.siteUrl),
    title: fullTitle,
    description,
    keywords: Array.isArray(keywords) ? keywords.join(', ') : keywords,
    alternates: {
      canonical: finalCanonical,
      languages: alternates,
    },
    robots: {
      index: !noindex,
      follow: !nofollow,
      googleBot: {
        index: !noindex,
        follow: !nofollow,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      type: type === 'product' ? 'website' : type,
      locale: SEO_CONFIG.locale,
      url,
      title: fullTitle,
      description,
      siteName: SEO_CONFIG.siteName,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title || SEO_CONFIG.siteName }],
      ...(type === 'article' && {
        publishedTime,
        modifiedTime,
        authors: author ? [author] : undefined,
      }),
    },
    twitter: {
      card: 'summary_large_image',
      site: SEO_CONFIG.twitterHandle,
      creator: SEO_CONFIG.twitterHandle,
      title: fullTitle,
      description,
      images: [ogImage],
    },
  }

  return meta
}
