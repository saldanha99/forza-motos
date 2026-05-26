/**
 * Configuração central de SEO do Forza Motos.
 * Fonte única de verdade — edite aqui que reflete em todo o site.
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

  // Branding
  logo: '/logo.png',
  ogImage: '/og-default.jpg',
  twitterHandle: '@forzamotos',

  // Empresa
  business: {
    name: 'Forza Motos',
    legalName: 'Forza Motos',
    type: 'AutoPartsStore' as const,
    cnpj: '',
    telephone: '+55-19-0000-0000',
    email: 'contato@forzamotos.com.br',
    address: {
      streetAddress: '',
      addressLocality: 'Campinas',
      addressRegion: 'SP',
      postalCode: '',
      addressCountry: 'BR',
    },
    geo: {
      // Coordenadas de Campinas — atualize com o endereço exato
      latitude: -22.9056,
      longitude: -47.0608,
    },
    openingHours: ['Mo-Fr 08:00-18:00', 'Sa 08:00-13:00'],
    sameAs: [
      // redes sociais — adicionar quando tiver
      // 'https://www.instagram.com/forzamotos',
      // 'https://www.facebook.com/forzamotos',
    ],
  },

  // Defaults de robots
  robots: {
    disallow: [
      '/admin/',
      '/api/',
      '/minha-conta/',
      '/carrinho/',
      '/checkout/',
      '/login',
    ],
  },
} as const

export type SeoConfig = typeof SEO_CONFIG
