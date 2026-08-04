/**
 * PATCH  /api/admin/motos/[id] — medidas de fábrica e conferência
 * DELETE /api/admin/motos/[id] — remove a moto (e seus vínculos, por cascade)
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseMedida, formatarMedidaNeutra } from '@/lib/medida-pneu'

export const dynamic = 'force-dynamic'

/**
 * Aceita a medida em qualquer grafia e guarda SEM construção.
 * A mesma moto costuma aceitar radial e diagonal na medida de fábrica (uma
 * CB 300 ou uma GS 800 rodam com os dois) — a construção é escolha do
 * cliente na hora de comprar, não característica da moto.
 */
function normalizar(valor: unknown): { ok: true; medida: string | null } | { ok: false } {
  if (valor === null || valor === undefined || String(valor).trim() === '') {
    return { ok: true, medida: null }
  }
  const m = parseMedida(String(valor))
  if (!m) return { ok: false }
  return { ok: true, medida: formatarMedidaNeutra(m) }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}

  if ('medidaDianteira' in body) {
    const r = normalizar(body.medidaDianteira)
    if (!r.ok) return NextResponse.json({ error: 'Medida dianteira inválida. Use o formato 120/70-17.' }, { status: 400 })
    data.medidaDianteira = r.medida
  }
  if ('medidaTraseira' in body) {
    const r = normalizar(body.medidaTraseira)
    if (!r.ok) return NextResponse.json({ error: 'Medida traseira inválida. Use o formato 180/55-17.' }, { status: 400 })
    data.medidaTraseira = r.medida
  }
  if ('medidasConferidas' in body) {
    data.medidasConferidas = Boolean(body.medidasConferidas)
    // Conferido pela loja passa a ser a origem do dado
    if (data.medidasConferidas) data.fonteMedidas = 'loja'
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 })
  }

  // Não faz sentido marcar como conferida sem ter as duas medidas
  if (data.medidasConferidas === true) {
    const atual = await prisma.moto.findUnique({ where: { id: params.id } })
    const dia = 'medidaDianteira' in data ? data.medidaDianteira : atual?.medidaDianteira
    const tra = 'medidaTraseira' in data ? data.medidaTraseira : atual?.medidaTraseira
    if (!dia || !tra) {
      return NextResponse.json(
        { error: 'Preencha as duas medidas antes de marcar como conferida.' },
        { status: 400 },
      )
    }
  }

  const moto = await prisma.moto.update({ where: { id: params.id }, data }).catch(() => null)
  if (!moto) return NextResponse.json({ error: 'Moto não encontrada.' }, { status: 404 })
  return NextResponse.json(moto)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await prisma.moto.delete({ where: { id: params.id } }).catch(() => {})
  return NextResponse.json({ ok: true })
}
