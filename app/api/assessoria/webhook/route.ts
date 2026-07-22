/**
 * POST /api/assessoria/webhook — recebe eventos da Evolution API (MESSAGES_UPSERT)
 * e, quando a mensagem vem do GRUPO de assessoria, responde com a IA (Fase 3).
 *
 * Configurar na Evolution (webhook por evento) apontando para esta URL, evento
 * MESSAGES_UPSERT. Só reage a mensagens do grupo GRUPO_ASSESSORIA_JID e ignora
 * as próprias mensagens (fromMe) para não entrar em loop.
 */
import { NextResponse } from 'next/server'
import { getGrupoJid, enviarParaGrupo } from '@/lib/evolution/grupo'
import { responderAssessoria } from '@/lib/estoque/ia-assessoria'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Extrai o texto de uma mensagem da Evolution (vários formatos possíveis) */
function extrairTexto(message: any): string {
  if (!message) return ''
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ''
  ).trim()
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  // A Evolution manda { event, instance, data: {...} }
  const data = body?.data
  const evento = body?.event

  // Só interessa mensagem recebida
  if (!data || (evento && !String(evento).toLowerCase().includes('messages'))) {
    return NextResponse.json({ ok: true, ignorado: 'evento' })
  }

  const remoteJid: string = data.key?.remoteJid ?? ''
  const fromMe: boolean = Boolean(data.key?.fromMe)

  // Ignora mensagens próprias (evita loop de resposta)
  if (fromMe) return NextResponse.json({ ok: true, ignorado: 'fromMe' })

  const grupoJid = await getGrupoJid()
  // Só responde no grupo de assessoria configurado
  if (!grupoJid || remoteJid !== grupoJid) {
    return NextResponse.json({ ok: true, ignorado: 'fora-do-grupo' })
  }

  const texto = extrairTexto(data.message)
  if (!texto || texto.length < 3) {
    return NextResponse.json({ ok: true, ignorado: 'sem-texto' })
  }

  try {
    const resposta = await responderAssessoria(texto)
    await enviarParaGrupo(resposta)
  } catch (e) {
    console.error('[assessoria/webhook]', e)
    // Não falha o webhook (a Evolution reentrega em erro) — só loga
  }

  return NextResponse.json({ ok: true })
}
