/**
 * Schemas JSON-LD centralizados — Forza Motos
 *
 * Use estas funções para injetar dados estruturados em qualquer página.
 * Cada helper retorna um objeto pronto para JSON.stringify e <script type="application/ld+json">.
 *
 * Endereço oficial: R. Funilense, 110 — Campinas/SP — CEP 13060-080
 */

export const SITE_URL = 'https://forzamotos.com.br'
export const SITE_NAME = 'Forza Motos'
export const SITE_PHONE = '+55-19-97404-9445'
export const SITE_WHATSAPP = '5519974049445'

export const ADDRESS = {
  '@type': 'PostalAddress' as const,
  streetAddress: 'R. Funilense, 110',
  addressLocality: 'Campinas',
  addressRegion: 'SP',
  postalCode: '13060-080',
  addressCountry: 'BR',
}

export const GEO = {
  '@type': 'GeoCoordinates' as const,
  latitude: -22.9068,
  longitude: -47.0626,
}

export const OPENING_HOURS = [
  {
    '@type': 'OpeningHoursSpecification' as const,
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '09:00',
    closes: '18:00',
  },
  {
    '@type': 'OpeningHoursSpecification' as const,
    dayOfWeek: 'Saturday',
    opens: '08:00',
    closes: '12:00',
  },
]

/**
 * LocalBusiness + AutoRepair — para homepage e páginas institucionais
 * Combina os dois tipos para SEO local máximo.
 */
export function getLocalBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'AutoRepair', 'AutoPartsStore'],
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    description:
      'Loja especializada em pneus de moto, óleo, pastilhas de freio e serviços de oficina em Campinas/SP. Credenciada Pirelli, Metzeler e Michelin. Troca de pneu com instalação inclusa.',
    url: SITE_URL,
    telephone: SITE_PHONE,
    image: `${SITE_URL}/og-image.jpg`,
    logo: `${SITE_URL}/og-image.jpg`,
    address: ADDRESS,
    geo: GEO,
    openingHoursSpecification: OPENING_HOURS,
    priceRange: '$$',
    paymentAccepted: ['Cash', 'Credit Card', 'PIX'],
    currenciesAccepted: 'BRL',
    hasMap: 'https://maps.google.com/?q=R.+Funilense,+110+Campinas+SP',
    sameAs: [
      'https://www.instagram.com/forzamotos',
      'https://www.facebook.com/forzamotos',
    ],
    areaServed: {
      '@type': 'City',
      name: 'Campinas',
    },
  }
}

/**
 * BreadcrumbList — use em todas as páginas internas
 * Cada item: { name: 'Pneus', url: '/pneus' }
 */
export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${SITE_URL}${item.url}`,
    })),
  }
}

/**
 * Product Schema — para página de produto individual
 */
export function getProductSchema(produto: {
  nome: string
  descricao?: string
  sku: string
  marca?: string
  categoria?: string
  preco: number | string
  precoPromocional?: number | string | null
  imagem?: string
  slug: string
  estoque: number
}) {
  const preco = Number(produto.precoPromocional ?? produto.preco)

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produto.nome,
    description: produto.descricao || produto.nome,
    sku: produto.sku,
    mpn: produto.sku,
    brand: { '@type': 'Brand', name: produto.marca || 'Forza Motos' },
    category: produto.categoria,
    image: produto.imagem ? [produto.imagem] : undefined,
    url: `${SITE_URL}/produtos/${produto.slug}`,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/produtos/${produto.slug}`,
      priceCurrency: 'BRL',
      price: preco.toFixed(2),
      priceValidUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      availability:
        produto.estoque > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
  }
}

/**
 * FAQPage Schema — captura featured snippets
 */
export function getFAQSchema(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/**
 * Article Schema — para posts do blog
 */
export function getArticleSchema(post: {
  titulo: string
  slug: string
  conteudo?: string
  autor: string
  capaUrl?: string | null
  createdAt: Date | string
  updatedAt: Date | string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.titulo,
    description: post.conteudo?.slice(0, 200),
    image: post.capaUrl || `${SITE_URL}/og-image.jpg`,
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    author: { '@type': 'Organization', name: post.autor || SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/og-image.jpg` },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug}`,
    },
  }
}

/**
 * Service Schema — usado em /servicos
 */
export function getServiceSchema(servico: {
  nome: string
  descricao: string
  preco?: string
  url: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: servico.nome,
    name: servico.nome,
    description: servico.descricao,
    provider: {
      '@type': 'LocalBusiness',
      name: SITE_NAME,
      address: ADDRESS,
      telephone: SITE_PHONE,
    },
    areaServed: { '@type': 'City', name: 'Campinas' },
    url: servico.url,
    ...(servico.preco && {
      offers: {
        '@type': 'Offer',
        price: servico.preco,
        priceCurrency: 'BRL',
      },
    }),
  }
}
