import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

/**
 * Logger de 404 para detectar links quebrados e oportunidades de redirect.
 *
 * Uso em app/not-found.tsx (página global 404):
 *
 *   import { log404 } from '@/lib/seo/not-found-logger'
 *
 *   export default async function NotFound() {
 *     await log404()
 *     return <div>Página não encontrada</div>
 *   }
 *
 * Os 404s aparecem agregados (por path) com contador de hits — visualize no
 * admin em /admin/seo/404.
 */
export async function log404() {
  try {
    const h = headers()
    const path = h.get('x-pathname') || h.get('referer') || '/desconhecido'
    const userAgent = h.get('user-agent')?.slice(0, 500) || null
    const referer = h.get('referer') || null
    const xff = h.get('x-forwarded-for') || ''
    // Anonimiza IP — zera últimos octetos
    const ip = xff.split(',')[0]?.trim().replace(/\.\d+\.\d+$/, '.0.0') || null

    // Limita o path para não logar URLs absurdas
    const pathLimpo = path.startsWith('http') ? new URL(path).pathname : path
    if (pathLimpo.length > 500) return

    await prisma.seoNotFoundLog.upsert({
      where: { path: pathLimpo },
      update: {
        hits: { increment: 1 },
        ultimoAcesso: new Date(),
        userAgent,
        referer,
        ip,
      },
      create: {
        path: pathLimpo,
        userAgent,
        referer,
        ip,
        hits: 1,
      },
    })
  } catch {
    // Nunca quebra a página por causa do logger
  }
}

/**
 * Para usar `headers().get('x-pathname')` o middleware precisa setar este header.
 * Adicione no middleware.ts:
 *
 *   const response = NextResponse.next()
 *   response.headers.set('x-pathname', req.nextUrl.pathname)
 *   return response
 */
