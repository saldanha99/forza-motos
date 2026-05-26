/**
 * Builders de JSON-LD (schema.org) para SEO de Rich Snippets.
 *
 * Uso típico — renderize com o componente <JsonLd> em uma page.tsx:
 *
 *   import { organizationSchema, productSchema } from '@/lib/seo/schema'
 *   import { JsonLd } from '@/components/seo/JsonLd'
 *
 *   <JsonLd data={productSchema({ name: produto.nome, ... })} />
 *
 * Schemas que aparecem em buscas (Google Rich Results):
 *   - Product (preço, estoque, rating)
 *   - Article / BlogPosting
 *   - FAQPage
 *   - BreadcrumbList
 *   - LocalBusiness
 *   - DefinedTerm (glossário)
 *   - Service
 *   - VideoObject
 */
import { SEO_CONFIG } from './config'

// ============================================================
// Organization / LocalBusiness
// ============================================================

export function organizationSchema() {
  const b = SEO_CONFIG.business
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: b.name,
    legalName: b.legalName,
    url: SEO_CONFIG.siteUrl,
    logo: `${SEO_CONFIG.siteUrl}${SEO_CONFIG.logo}`,
    email: b.email,
    telephone: b.telephone,
    address: {
      '@type': 'PostalAddress',
      ...b.address,
    },
    sameAs: b.sameAs,
  }
}

export function localBusinessSchema() {
  const b = SEO_CONFIG.business
  return {
    '@context': 'https://schema.org',
    '@type': b.type,
    name: b.name,
    image: `${SEO_CONFIG.siteUrl}${SEO_CONFIG.logo}`,
    '@id': SEO_CONFIG.siteUrl,
    url: SEO_CONFIG.siteUrl,
    telephone: b.telephone,
    email: b.email,
    address: {
      '@type': 'PostalAddress',
      ...b.address,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: b.geo.latitude,
      longitude: b.geo.longitude,
    },
    openingHoursSpecification: b.openingHours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      // Parse simples: "Mo-Fr 08:00-18:00"
      description: h,
    })),
    sameAs: b.sameAs,
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SEO_CONFIG.siteName,
    url: SEO_CONFIG.siteUrl,
    inLanguage: SEO_CONFIG.language,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SEO_CONFIG.siteUrl}/produtos?busca={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

// ============================================================
// Product
// ============================================================

export interface ProductSchemaInput {
  name: string
  description: string
  image: string | string[]
  sku?: string
  brand?: string
  price: number
  priceCurrency?: string
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder'
  rating?: { value: number; count: number }
  url: string
  category?: string
  /** Data ISO até quando o preço é válido (preferencialmente 1 ano à frente) */
  priceValidUntil?: string
}

export function productSchema(p: ProductSchemaInput) {
  const images = Array.isArray(p.image) ? p.image : [p.image]
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    image: images,
    sku: p.sku,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    category: p.category,
    offers: {
      '@type': 'Offer',
      url: p.url,
      priceCurrency: p.priceCurrency || 'BRL',
      price: p.price.toFixed(2),
      availability: `https://schema.org/${p.availability || 'InStock'}`,
      priceValidUntil:
        p.priceValidUntil ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      seller: { '@type': 'Organization', name: SEO_CONFIG.business.name },
    },
    ...(p.rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: p.rating.value,
        reviewCount: p.rating.count,
      },
    }),
  }
}

// ============================================================
// Article / BlogPosting
// ============================================================

export interface ArticleSchemaInput {
  headline: string
  description: string
  image: string
  datePublished: string
  dateModified?: string
  author: string
  url: string
}

export function articleSchema(a: ArticleSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: a.headline,
    description: a.description,
    image: a.image,
    datePublished: a.datePublished,
    dateModified: a.dateModified || a.datePublished,
    author: { '@type': 'Person', name: a.author },
    publisher: {
      '@type': 'Organization',
      name: SEO_CONFIG.business.name,
      logo: { '@type': 'ImageObject', url: `${SEO_CONFIG.siteUrl}${SEO_CONFIG.logo}` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.url },
  }
}

// ============================================================
// FAQ
// ============================================================

export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  }
}

// ============================================================
// Breadcrumbs
// ============================================================

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SEO_CONFIG.siteUrl}${item.url}`,
    })),
  }
}

// ============================================================
// DefinedTerm (Glossário)
// ============================================================

export interface DefinedTermInput {
  term: string
  definition: string
  url: string
  /** Letra do alfabeto (categoria) — opcional */
  inDefinedTermSet?: { name: string; url: string }
}

export function definedTermSchema(t: DefinedTermInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: t.term,
    description: t.definition,
    url: t.url,
    inLanguage: SEO_CONFIG.language,
    ...(t.inDefinedTermSet && {
      inDefinedTermSet: {
        '@type': 'DefinedTermSet',
        name: t.inDefinedTermSet.name,
        url: t.inDefinedTermSet.url,
      },
    }),
  }
}

export function definedTermSetSchema(input: {
  name: string
  description: string
  url: string
  termsCount?: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: SEO_CONFIG.language,
    ...(input.termsCount && { numberOfItems: input.termsCount }),
  }
}

// ============================================================
// Service
// ============================================================

export function serviceSchema(s: {
  name: string
  description: string
  url: string
  price?: number
  areaServed?: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: s.name,
    description: s.description,
    url: s.url,
    provider: { '@type': 'Organization', name: SEO_CONFIG.business.name },
    areaServed: s.areaServed || 'Brasil',
    ...(s.price && {
      offers: {
        '@type': 'Offer',
        price: s.price.toFixed(2),
        priceCurrency: 'BRL',
      },
    }),
  }
}
