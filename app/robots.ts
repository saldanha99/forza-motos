import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://forza-motos-app.vercel.app'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/minha-conta/', '/carrinho/', '/checkout/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
