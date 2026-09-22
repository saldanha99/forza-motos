/**
 * GET /api/evolution/qrcode
 * Retorna QR code em base64 para conectar o WhatsApp.
 * Se a instância não existir, cria automaticamente.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { resolverQrDataUri } from '@/lib/evolution/qr'
import { authOptions } from '@/lib/auth'
import { getInstanciaAtiva } from '@/lib/evolution/instancia'
import { obterUrlWebhookEvolution } from '@/lib/evolution/client'

const BASE_URL  = process.env.EVOLUTION_API_URL   ?? ''
const API_KEY   = process.env.EVOLUTION_API_KEY   ?? ''

export const dynamic = 'force-dynamic'

async function criarInstancia(INSTANCE: string) {
  const webhookUrl = obterUrlWebhookEvolution()
  const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim()
  const res = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({
      instanceName:  INSTANCE,
      integration:   'WHATSAPP-BAILEYS',
      qrcode:        true,
      // Formato atual da Evolution v2. O cron também confere/repara esta
      // configuração, inclusive para instâncias criadas anteriormente.
      ...(webhookUrl && webhookSecret ? {
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          headers: { 'x-forza-webhook-secret': webhookSecret },
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
        },
      } : {}),
    }),
  })
  return res
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const INSTANCE = await getInstanciaAtiva()

  if (!BASE_URL || !API_KEY) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 503 })
  }

  try {
    // Tenta conectar (gera QR se não conectado)
    let connectRes = await fetch(`${BASE_URL}/instance/connect/${INSTANCE}`, {
      headers: { apikey: API_KEY },
      next: { revalidate: 0 },
    })

    // Se instância não existe, cria e tenta novamente
    if (connectRes.status === 404 || connectRes.status === 400) {
      const criar = await criarInstancia(INSTANCE)
      if (!criar.ok) {
        const err = await criar.text()
        return NextResponse.json({ error: `Erro ao criar instância: ${err}` }, { status: 500 })
      }
      // Re-tenta connect após criar
      await new Promise(r => setTimeout(r, 1500))
      connectRes = await fetch(`${BASE_URL}/instance/connect/${INSTANCE}`, {
        headers: { apikey: API_KEY },
        next: { revalidate: 0 },
      })
    }

    if (!connectRes.ok) {
      return NextResponse.json({ error: `Evolution HTTP ${connectRes.status}` }, { status: 502 })
    }

    const data = await connectRes.json()

    // Evolution v2: { code: "...", base64: "data:image/png;base64,..." }
    // Se já estiver conectado: retorna state=open sem qr
    if (data?.instance?.state === 'open' || data?.state === 'open') {
      return NextResponse.json({ connected: true })
    }

    // `code` é o payload de pareamento, não uma imagem — quando é só isso que
    // vem, o PNG é desenhado no servidor. Ver lib/evolution/qr.ts.
    const qr = await resolverQrDataUri(data)

    if (!qr) {
      return NextResponse.json({ error: 'QR code não disponível' }, { status: 422 })
    }

    return NextResponse.json({ qr, connected: false })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
