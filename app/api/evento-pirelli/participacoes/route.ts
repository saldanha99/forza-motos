import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { eventoDisponivel, mensagemEventoPirelliIndisponivel } from '@/lib/evento-pirelli'
import { DESAFIO_FOTO_ATIVO } from '@/lib/evento-pirelli/config'

const MAX_PAYLOAD_BYTES = 4 * 1024
const HORARIOS = new Set(['Manhã', 'Início da tarde', 'Fim da tarde', 'Tanto faz'])
const INSTAGRAM = /^[A-Za-z0-9._]{1,30}$/

async function lerEntrada(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return null
  const texto = await request.text()
  if (new TextEncoder().encode(texto).byteLength > MAX_PAYLOAD_BYTES) return null
  try {
    const body = JSON.parse(texto)
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null
    const codigo = typeof body.codigo === 'string' ? body.codigo.trim() : ''
    const tipo = body.tipo === 'foto' || body.tipo === 'balanceamento' ? body.tipo : null
    if (!codigo || codigo.length > 100 || !tipo) return null
    return { body, codigo, tipo }
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  try {
    const entrada = await lerEntrada(request)
    if (!entrada) return NextResponse.json({ error: 'Participação inválida.' }, { status: 400 })
    const visitante = await prisma.eventoPirelliVisitante.findUnique({ where: { codigoQr: entrada.codigo }, include: { evento: true } })
    if (!visitante) return NextResponse.json({ error: 'Cadastro não encontrado.' }, { status: 404 })
    if (!eventoDisponivel(visitante.evento)) {
      return NextResponse.json({ error: mensagemEventoPirelliIndisponivel(visitante.evento) }, { status: 403 })
    }

    if (entrada.tipo === 'foto') {
      if (!DESAFIO_FOTO_ATIVO) {
        return NextResponse.json({ error: 'O desafio da foto não faz parte desta edição do evento.' }, { status: 410 })
      }
      const instagram = String(entrada.body.instagram ?? '').trim().replace(/^@/, '')
      if (
        !INSTAGRAM.test(instagram)
        || entrada.body.declarouMarcacoes !== true
        || entrada.body.declarouHashtag !== true
        || entrada.body.declarouPerfilPublico !== true
      ) {
        return NextResponse.json({ error: 'Informe um @ válido e confirme marcações, hashtag e perfil público.' }, { status: 400 })
      }
      await prisma.eventoPirelliParticipacaoFoto.upsert({
        where: { visitanteId: visitante.id },
        create: {
          visitanteId: visitante.id,
          instagram,
          declarouMarcacoes: true,
          declarouHashtag: true,
          declarouPerfilPublico: true,
        },
        update: {
          instagram,
          declarouMarcacoes: true,
          declarouHashtag: true,
          declarouPerfilPublico: true,
          declarouPublicacaoEm: new Date(),
        },
      })
    } else {
      const horario = String(entrada.body.horario ?? '').trim()
      if (!HORARIOS.has(horario)) return NextResponse.json({ error: 'Escolha um período válido.' }, { status: 400 })
      await prisma.eventoPirelliBalanceamento.upsert({
        where: { visitanteId: visitante.id },
        create: { visitanteId: visitante.id, horarioPreferido: horario },
        update: { horarioPreferido: horario },
      })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[evento-pirelli/participacoes]', error)
    return NextResponse.json({ error: 'Não foi possível registrar agora.' }, { status: 500 })
  }
}
