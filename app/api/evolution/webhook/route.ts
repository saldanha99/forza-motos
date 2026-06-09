/**
 * POST /api/evolution/webhook
 * Recebe eventos da Evolution API (mensagens enviadas, entregues, lidas, recebidas)
 * Configura no painel da Evolution: URL = https://forzamotos.com.br/api/evolution/webhook
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizarWhatsApp } from '@/lib/evolution/client'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const evento = body.event ?? body.type ?? ''

    // ── Atualização de status de mensagem enviada ──────────────────────────
    if (evento === 'messages.update' || evento === 'MESSAGES_UPDATE') {
      const updates = Array.isArray(body.data) ? body.data : [body.data]

      for (const upd of updates) {
        const evolutionId = upd?.key?.id
        if (!evolutionId) continue

        // status da Evolution: 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ
        const ack = upd?.update?.status ?? upd?.status
        let novoStatus: string | null = null
        if (ack === 3 || ack === 'DELIVERY_ACK') novoStatus = 'ENTREGUE'
        if (ack === 4 || ack === 'READ') novoStatus = 'LIDA'

        if (novoStatus) {
          await prisma.crmMensagem.updateMany({
            where: { evolutionId },
            data: { status: novoStatus as any },
          })
        }
      }

      return NextResponse.json({ ok: true })
    }

    // ── Mensagem recebida do cliente (resposta) ────────────────────────────
    if (evento === 'messages.upsert' || evento === 'MESSAGES_UPSERT') {
      const msgs = Array.isArray(body.data) ? body.data : [body.data]

      for (const msg of msgs) {
        // Ignora mensagens enviadas por nós (fromMe: true)
        if (msg?.key?.fromMe) continue

        const numero = normalizarWhatsApp(msg?.key?.remoteJid?.replace('@s.whatsapp.net', '') ?? '')
        if (!numero) continue

        // Atualiza lead para RESPONDEU
        await prisma.crmLead.updateMany({
          where: { whatsapp: numero, etapa: { in: ['NOVO', 'CONTATADO'] } },
          data: { etapa: 'RESPONDEU' },
        })

        console.log(`[evolution/webhook] Lead ${numero} respondeu no WhatsApp`)
      }

      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ ok: true, evento_ignorado: evento })
  } catch (e) {
    console.error('[evolution/webhook]', e)
    return NextResponse.json({ ok: true }) // sempre 200
  }
}
