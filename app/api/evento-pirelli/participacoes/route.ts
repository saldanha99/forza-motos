import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventoDisponivel } from '@/lib/evento-pirelli'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const visitante = await prisma.eventoPirelliVisitante.findUnique({ where: { codigoQr: String(body.codigo ?? '') }, include: { evento: true } })
    if (!visitante) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
    if (!eventoDisponivel(visitante.evento)) return NextResponse.json({ error: 'Este evento não está mais disponível.' }, { status: 403 })
    if (body.tipo === 'foto') {
      const instagram = String(body.instagram ?? '').trim().replace(/^@/, '')
      if (!instagram || !body.declarouMarcacoes) return NextResponse.json({ error: 'Informe seu @ e confirme as marcações.' }, { status: 400 })
      await prisma.eventoPirelliParticipacaoFoto.upsert({ where: { visitanteId: visitante.id }, create: { visitanteId: visitante.id, instagram, declarouMarcacoes: true }, update: { instagram, declarouMarcacoes: true } })
    } else if (body.tipo === 'balanceamento') {
      await prisma.eventoPirelliBalanceamento.upsert({ where: { visitanteId: visitante.id }, create: { visitanteId: visitante.id, horarioPreferido: String(body.horario ?? '') || null }, update: { horarioPreferido: String(body.horario ?? '') || null } })
    } else return NextResponse.json({ error: 'Participação inválida.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 }) }
}
