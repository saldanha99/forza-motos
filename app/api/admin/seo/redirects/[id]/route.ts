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

/** PATCH — edita qualquer campo do redirect (from, to, statusCode, ativo, notas). */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // P2025 do update/delete já cobre o caso de o registro ter sumido;
  // esta consulta é só para responder 404 cedo, sem custo de escrita.
  const existente = await prisma.seoRedirect.findUnique({ where: { id: params.id } })
  if (!existente) {
    return NextResponse.json({ error: 'Redirect não encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))

  // Campos ausentes no body mantêm o valor atual — PATCH parcial.
  const from = typeof body.from === 'string' ? body.from.trim() : existente.from
  const to = typeof body.to === 'string' ? body.to.trim() : existente.to
  const statusCode = body.statusCode !== undefined ? Number(body.statusCode) : existente.statusCode
  const ativo = typeof body.ativo === 'boolean' ? body.ativo : existente.ativo
  const notas =
    body.notas === undefined
      ? existente.notas
      : typeof body.notas === 'string' && body.notas.trim()
        ? body.notas.trim()
        : null

  const erro = validarRedirect(from, to, statusCode)
  if (erro) {
    return NextResponse.json({ error: erro }, { status: 400 })
  }

  try {
    const atualizado = await prisma.seoRedirect.update({
      where: { id: params.id },
      data: { from, to, statusCode, ativo, notas },
    })
    invalidarCacheRedirects()
    return NextResponse.json(atualizado)
  } catch (e: any) {
    // `from` é @unique no schema — trata a violação em vez de estourar 500.
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: `Já existe um redirect cadastrado para "${from}"` }, { status: 409 })
    }
    // Apagado entre a checagem e o update
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Redirect não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: e?.message ?? 'Erro ao atualizar redirect' }, { status: 500 })
  }
}

/** DELETE — remove o redirect. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  // P2025 do update/delete já cobre o caso de o registro ter sumido;
  // esta consulta é só para responder 404 cedo, sem custo de escrita.
  const existente = await prisma.seoRedirect.findUnique({ where: { id: params.id } })
  if (!existente) {
    return NextResponse.json({ error: 'Redirect não encontrado' }, { status: 404 })
  }

  try {
    await prisma.seoRedirect.delete({ where: { id: params.id } })
  } catch (e: any) {
    // Apagado entre a checagem e o delete
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Redirect não encontrado' }, { status: 404 })
    }
    throw e
  }
  invalidarCacheRedirects()

  return NextResponse.json({ ok: true })
}
