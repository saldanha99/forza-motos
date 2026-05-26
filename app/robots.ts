import type { MetadataRoute } from 'next'
import { SEO_CONFIG } from '@/lib/seo/config'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [...SEO_CONFIG.robots.disallow],
      },
    ],
    sitemap: `${SEO_CONFIG.siteUrl}/sitemap.xml`,
    host: SEO_CONFIG.siteUrl,
  }
}
