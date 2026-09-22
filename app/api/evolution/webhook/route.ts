/**
 * POST /api/evolution/webhook
 * Recebe eventos da Evolution API (mensagens enviadas, entregues, lidas, recebidas)
 * Configura no painel da Evolution: URL = https://forzamotos.com.br/api/evolution/webhook
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import { getInstanciaAtiva } from '@/lib/evolution/instancia'
import {
  solicitouOptOutWhatsapp,
  statusConfirmadoEvolution,
} from '@/lib/evolution/webhook-seguranca'

function normalizarEvento(valor: unknown): string {
  return String(valor ?? '').trim().replace(/[.-]/g, '_').toUpperCase()
}

function listaDados(data: any): any[] {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.updates)) return data.updates
  if (Array.isArray(data?.messages)) return data.messages
  return data ? [data] : []
}

function idMensagemEvolution(update: any): string | null {
  const id = update?.key?.id
    ?? update?.keyId
    ?? update?.messageId
    ?? update?.id
    ?? update?.update?.key?.id
    ?? update?.data?.key?.id
    ?? update?.data?.keyId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

function webhookAutorizado(req: Request, body: any): boolean {
  const segredo = process.env.EVOLUTION_WEBHOOK_SECRET?.trim()
  if (segredo) return req.headers.get('x-forza-webhook-secret') === segredo

  // Produção é fail-closed: sem segredo dedicado nenhum payload altera o
  // CRM. O cron registra o header automaticamente assim que a env existir.
  if (process.env.NODE_ENV === 'production') return false

  const apiKeyRecebida = body?.apikey
  const apiKeyEsperada = process.env.EVOLUTION_API_KEY
  if (apiKeyRecebida && apiKeyEsperada) return apiKeyRecebida === apiKeyEsperada
  return true
}

function textoMensagemRecebida(msg: any): string {
  const mensagem = msg?.message ?? msg?.data?.message ?? {}
  return String(
    mensagem?.conversation
      ?? mensagem?.extendedTextMessage?.text
      ?? mensagem?.buttonsResponseMessage?.selectedDisplayText
      ?? mensagem?.listResponseMessage?.title
      ?? msg?.text
      ?? '',
  ).trim()
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  if (!webhookAutorizado(req, body)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const instanciaAtiva = await getInstanciaAtiva()
    const instanciaEvento = String(body.instance ?? '').trim()
    if (instanciaEvento && instanciaEvento.toLowerCase() !== instanciaAtiva.toLowerCase()) {
      return NextResponse.json({ ok: true, instancia_ignorada: true })
    }
    const evento = normalizarEvento(body.event ?? body.type)

    // ── Atualização de status de mensagem enviada ──────────────────────────
    if (evento === 'MESSAGES_UPDATE' || evento === 'SEND_MESSAGE_UPDATE') {
      const updates = listaDados(body.data)
      let atualizadas = 0

      for (const upd of updates) {
        const evolutionId = idMensagemEvolution(upd)
        const novoStatus = statusConfirmadoEvolution(upd)
        if (!evolutionId || !novoStatus) continue

        const resultado = await prisma.crmMensagem.updateMany({
          where: {
            evolutionId,
            status: novoStatus === 'LIDA'
              ? { in: ['ENVIANDO', 'ENVIADA', 'ENTREGUE'] }
              : { in: ['ENVIANDO', 'ENVIADA'] },
          },
          data: { status: novoStatus as any, erro: null },
        })
        atualizadas += resultado.count
      }

      return NextResponse.json({ ok: true, atualizadas })
    }

    // ── Mensagem recebida do cliente (resposta) ────────────────────────────
    if (evento === 'MESSAGES_UPSERT') {
      const msgs = listaDados(body.data)

      for (const msg of msgs) {
        // Ignora mensagens enviadas por nós (fromMe: true)
        if (msg?.key?.fromMe === true || msg?.fromMe === true) continue

        const jid = String(msg?.key?.remoteJid ?? msg?.remoteJid ?? '')
        if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') continue
        const numero = normalizarWhatsApp(jid.replace(/@.*$/, ''))
        if (!numero) continue

        if (solicitouOptOutWhatsapp(textoMensagemRecebida(msg))) {
          const [, canceladas] = await prisma.$transaction([
            prisma.crmLead.updateMany({
              where: { whatsapp: numero },
              data: { whatsappOptOutEm: new Date() },
            }),
            prisma.crmMensagem.updateMany({
              where: { whatsapp: numero, status: 'PENDENTE' },
              data: { status: 'CANCELADA', erro: null, leaseExpiraEm: null },
            }),
          ])
          console.log(
            `[evolution/webhook] Opt-out WhatsApp final ${numero.slice(-4)}; ` +
              `pendentes canceladas=${canceladas.count}`,
          )
          continue
        }

        // Atualiza lead para RESPONDEU
        await prisma.crmLead.updateMany({
          where: { whatsapp: numero, etapa: { in: ['NOVO', 'CONTATADO'] } },
          data: { etapa: 'RESPONDEU' },
        })

        console.log(`[evolution/webhook] Lead final ${numero.slice(-4)} respondeu no WhatsApp`)
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true, evento_ignorado: evento })
  } catch (error) {
    console.error('[evolution/webhook]', error)
    // A Evolution retenta 5xx; isso evita perder o ACK quando o banco cai.
    return NextResponse.json({ error: 'Falha temporária ao processar webhook' }, { status: 500 })
  }
}
