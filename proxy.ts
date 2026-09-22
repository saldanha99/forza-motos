import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { permissoesEfetivas, podeAcessarRota, rotaInicial } from '@/lib/admin/permissoes'

export default withAuth(
  function proxy(req) {
    const { pathname, search } = req.nextUrl
    const token = req.nextauth.token

    if (pathname.startsWith('/admin')) {
      const papel = token?.role as string | undefined

      // Cliente comum não tem nada no painel.
      if (papel !== 'ADMIN' && papel !== 'MARKETING') {
        const login = new URL('/login', req.url)
        login.searchParams.set('callbackUrl', `${pathname}${search}`)
        return NextResponse.redirect(login)
      }

      // Primeiro portão, feito com o que o token carrega. A permissão que vale
      // é conferida no servidor (lib/admin/acesso.ts), que relê o banco — aqui
      // no edge não há acesso ao Prisma.
      const permissoes = permissoesEfetivas(papel, token?.permissoes)
      if (!podeAcessarRota(permissoes, pathname)) {
        // Manda para a primeira área que a pessoa enxerga, em vez de um 403
        // seco: quem tem só Marketing cai direto no Marketing.
        const destino = rotaInicial(permissoes)
        if (destino !== pathname) return NextResponse.redirect(new URL(destino, req.url))

        const login = new URL('/login', req.url)
        login.searchParams.set('callbackUrl', `${pathname}${search}`)
        return NextResponse.redirect(login)
      }
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
        // /admin exige autenticação (papel e permissão verificados acima)
        if (pathname.startsWith('/admin')) return !!token
        return true
      },
    },
  },
)

export const config = {
  matcher: ['/admin/:path*', '/minha-conta/:path*'],
}
