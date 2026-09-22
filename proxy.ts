import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function proxy(req) {
    const { pathname, search } = req.nextUrl
    const token = req.nextauth.token

    // Bloquear /admin/* para não-ADMIN
    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
      const login = new URL('/login', req.url)
      login.searchParams.set('callbackUrl', `${pathname}${search}`)
      return NextResponse.redirect(login)
    }

    // Header usado pelo logger de 404 (lib/seo/not-found-logger.ts)
    const res = NextResponse.next()
    res.headers.set('x-pathname', pathname)
    return res
  },
  {
    callbacks: {
      authorized({ token, req }) {
        const { pathname } = req.nextUrl
        // /minha-conta exige autenticação
        if (pathname.startsWith('/minha-conta')) return !!token
        // /admin exige autenticação (role verificada acima)
        if (pathname.startsWith('/admin')) return !!token
        return true
      },
    },
  },
)

export const config = {
  matcher: ['/admin/:path*', '/minha-conta/:path*'],
}
