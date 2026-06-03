/**
 * Configuração central de SEO — fonte única de verdade do 2time SEO.
 * Edite aqui e reflete em todo o site: sitemap, robots, schema.org, meta tags.
 */
export const SEO_CONFIG = {
  // Identidade do site
  siteName: 'Forza Motos',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://forza-motos-app.vercel.app',
  defaultTitle: 'Forza Motos — Pneus e Peças para Moto em Campinas/SP',
  defaultDescription:
    'Credenciada Pirelli, Metzeler e Michelin em Campinas/SP. Troca de pneu em 30 min sem agendamento. Box rápido: pneu, freio, óleo e transmissão. Loja online com entrega em todo Brasil.',
  locale: 'pt_BR',
  language: 'pt-BR',

  // Nicho para prompts de IA no glossário
  niche: 'pneus, peças e acessórios para motos',

  // Token de verificação do Google Search Console.
  // Cole aqui o valor do "content" da meta google-site-verification.
  googleSiteVerification: '',

  // Branding
  logo: '/logo.png',
  ogImage: '/og-default.jpg',
  twitterHandle: '',

  // Empresa (schema.org LocalBusiness)
  business: {
    name: 'Forza Motos',
    legalName: 'Forza Motos',
    type: 'AutoPartsStore' as const,
    cnpj: '',
    telephone: '+55-19-97404-9445',
    email: 'contato@forzamotos.com.br',
    address: {
      streetAddress: 'R. Funilense, 110',
      addressLocality: 'Campinas',
      addressRegion: 'SP',
      postalCode: '13060-080',
      addressCountry: 'BR',
    },
    geo: {
      latitude: -22.9068,
      longitude: -47.0626,
    },
    openingHours: ['Mo-Fr 08:00-18:00', 'Sa 08:00-13:00'],
    sameAs: [
      'https://www.instagram.com/forzamotos',
      'https://www.facebook.com/forzamotos',
    ],
  },

  // Autor padrão nos schema.org dos termos do glossário
  defaultAuthor: 'Equipe Forza',

  // Defaults de robots
  robots: {
    disallow: ['/admin/', '/api/', '/minha-conta/', '/carrinho/', '/checkout/', '/login'],
  },
} as const

export type SeoConfig = typeof SEO_CONFIG
