/**
 * GET /api/evolution/qrcode
 * Retorna QR code em base64 para conectar o WhatsApp.
 * Se a instância não existir, cria automaticamente.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL  = process.env.EVOLUTION_API_URL   ?? ''
const API_KEY   = process.env.EVOLUTION_API_KEY   ?? ''
const INSTANCE  = process.env.EVOLUTION_INSTANCE  ?? 'forza-motos'

export const dynamic = 'force-dynamic'

async function criarInstancia() {
  const res = await fetch(`${BASE_URL}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({
      instanceName:  INSTANCE,
      integration:   'WHATSAPP-BAILEYS',
      qrcode:        true,
      // Webhook configurado direto na criação
      webhookUrl:    `${process.env.NEXTAUTH_URL ?? ''}/api/evolution/webhook`,
      webhookEvents: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'SEND_MESSAGE'],
    }),
  })
  return res
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

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
      const criar = await criarInstancia()
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

    const base64: string | undefined =
      data?.base64 ??
      data?.qrcode?.base64 ??
      data?.qr?.base64 ??
      data?.code  // em algumas versões o code já é o base64

    if (!base64) {
      return NextResponse.json({ error: 'QR code não disponível', raw: data }, { status: 422 })
    }

    return NextResponse.json({
      qr:        base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`,
      connected: false,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
