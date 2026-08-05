import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidarCacheRedirects } from '@/lib/seo/redirects'

export const dynamic = 'force-dynamic'

/** Códigos HTTP de redirecionamento aceitos pelo formulário. */
const STATUS_CODES_VALIDOS = [301, 302, 307, 308]

/**
 * Valida os campos de um redirect antes de gravar no banco.
 * `from` precisa bater com `req.nextUrl.pathname` (sempre começa com "/",
 * sem querystring) — é como `aplicarRedirects` em lib/seo/redirects.ts casa
 * o registro com a requisição.
 */
function validarRedirect(from: string, to: string, statusCode: number): string | null {
  if (!from || !from.startsWith('/')) {
    return '"from" é obrigatório e precisa começar com "/"'
  }
  if (!to) {
    return '"to" é obrigatório'
  }
  const toEhUrlAbsoluta = /^https?:\/\//i.test(to)
  if (!toEhUrlAbsoluta && !to.startsWith('/')) {
    return '"to" precisa ser um path começando com "/" ou uma URL absoluta (http:// ou https://)'
  }
  if (!STATUS_CODES_VALIDOS.includes(statusCode)) {
    return '"statusCode" precisa ser 301, 302, 307 ou 308'
  }
  if (from === to) {
    return '"from" e "to" não podem ser iguais — isso criaria um loop de redirecionamento'
  }
  return null
}

/** GET — lista redirects (mesma ordenação da página, por hits desc). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const redirects = await prisma.seoRedirect.findMany({
    orderBy: { hits: 'desc' },
    take: 200,
  })

  return NextResponse.json(redirects)
}

/** POST — cria um novo redirect. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const from = typeof body.from === 'string' ? body.from.trim() : ''
  const to = typeof body.to === 'string' ? body.to.trim() : ''
  const statusCode = Number(body.statusCode ?? 301)
  const notas = typeof body.notas === 'string' && body.notas.trim() ? body.notas.trim() : null

  const erro = validarRedirect(from, to, statusCode)
  if (erro) {
    return NextResponse.json({ error: erro }, { status: 400 })
  }

  try {
    const criado = await prisma.seoRedirect.create({
      data: { from, to, statusCode, notas },
    })
    invalidarCacheRedirects()
    return NextResponse.json(criado, { status: 201 })
  } catch (e: any) {
    // `from` é @unique no schema — trata a violação em vez de estourar 500.
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: `Já existe um redirect cadastrado para "${from}"` }, { status: 409 })
    }
    return NextResponse.json({ error: e?.message ?? 'Erro ao criar redirect' }, { status: 500 })
  }
}
