import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * Helper de redirects gerenciáveis pelo banco.
 *
 * Uso no middleware.ts:
 *
 *   import { aplicarRedirects } from '@/lib/seo/redirects'
 *
 *   export async function middleware(req: NextRequest) {
 *     const redir = await aplicarRedirects(req)
 *     if (redir) return redir
 *     // ... outros middlewares
 *     return NextResponse.next()
 *   }
 *
 *   export const config = { matcher: ['/((?!_next|api|.*\\..*).*)'] }
 *
 * IMPORTANTE: faça cache no Edge (revalidate) — chamar Prisma em todo
 * request é caro. Veja a versão `aplicarRedirectsCached` abaixo.
 */

export async function aplicarRedirects(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname
  const redirect = await prisma.seoRedirect
    .findFirst({
      where: { from: pathname, ativo: true },
      select: { to: true, statusCode: true, id: true },
    })
    .catch(() => null)

  if (!redirect) return null

  // Incrementa contador de hits (fire-and-forget)
  prisma.seoRedirect
    .update({ where: { id: redirect.id }, data: { hits: { increment: 1 } } })
    .catch(() => null)

  const destino = redirect.to.startsWith('http')
    ? redirect.to
    : new URL(redirect.to, req.url).toString()

  return NextResponse.redirect(destino, redirect.statusCode)
}

// ============================================================
// Versão com cache em memória (recomendada para produção)
// ============================================================

let cache: Map<string, { to: string; statusCode: number; id: string }> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutos

async function getRedirectsCache() {
  const agora = Date.now()
  if (cache && agora - cacheTimestamp < CACHE_TTL) return cache

  const rows = await prisma.seoRedirect.findMany({
    where: { ativo: true },
    select: { from: true, to: true, statusCode: true, id: true },
  })

  cache = new Map(rows.map((r) => [r.from, { to: r.to, statusCode: r.statusCode, id: r.id }]))
  cacheTimestamp = agora
  return cache
}

export function invalidarCacheRedirects() {
  cache = null
  cacheTimestamp = 0
}

export async function aplicarRedirectsCached(
  req: NextRequest
): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname
  const map = await getRedirectsCache()
  const redirect = map.get(pathname)
  if (!redirect) return null

  // Incrementa hits em background (sem await)
  prisma.seoRedirect
    .update({ where: { id: redirect.id }, data: { hits: { increment: 1 } } })
    .catch(() => null)

  const destino = redirect.to.startsWith('http')
    ? redirect.to
    : new URL(redirect.to, req.url).toString()

  return NextResponse.redirect(destino, redirect.statusCode)
}
