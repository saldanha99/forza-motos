import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { atualizarFotoEvento, exigirAdmin } from '@/lib/evento-pirelli'

export async function GET() {
  if (!await exigirAdmin()) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  return NextResponse.json(await prisma.eventoPirelliParticipacaoFoto.findMany({ include: { visitante: { select: { id: true, nomeCompleto: true, nomeGravacao: true, whatsapp: true, canecaBrinde: true } } }, orderBy: { declarouPublicacaoEm: 'desc' } }))
}

export async function PATCH(request: Request) {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const body = await request.json()
  const status = body.status
  if (!['PENDENTE', 'FINALISTA', 'VENCEDOR', 'DESCARTADO'].includes(status)) return NextResponse.json({ error: 'Status inválido.' }, { status: 400 })
  const curtidas = body.curtidasApuradas == null || body.curtidasApuradas === '' ? null : Number(body.curtidasApuradas)
  if (curtidas !== null && (!Number.isInteger(curtidas) || curtidas < 0)) return NextResponse.json({ error: 'Curtidas inválidas.' }, { status: 400 })
  const operador = session.user.email ?? 'Equipe'
  const participacao = await atualizarFotoEvento({
    id: String(body.id),
    status,
    curtidasApuradas: curtidas,
    observacao: String(body.observacao ?? '').trim().slice(0, 1000) || null,
    operador,
  })
  return NextResponse.json(participacao)
}
