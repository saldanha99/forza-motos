/**
 * GET  /api/admin/whatsapp        → status + QR code da instância Evolution
 * POST /api/admin/whatsapp        → reconecta / reinicia a instância
 */
import { NextRequest, NextResponse } from 'next/server'

const BASE_URL  = () => process.env.EVOLUTION_API_URL ?? ''
const API_KEY   = () => process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE  = () => process.env.EVOLUTION_INSTANCE ?? 'forza-motos'

function evoHeaders() {
  return { apikey: API_KEY(), 'Content-Type': 'application/json' }
}

export async function GET() {
  const base     = BASE_URL()
  const instance = INSTANCE()

  if (!base || !API_KEY()) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 503 })
  }

  try {
    // 1. Estado da conexão
    const stateRes = await fetch(`${base}/instance/connectionState/${instance}`, {
      headers: evoHeaders(),
    })
    const stateData = await stateRes.json()
    const state: string = stateData?.instance?.state ?? stateData?.state ?? 'unknown'

    if (state === 'open') {
      return NextResponse.json({ state: 'open', qr: null, instance })
    }

    // 2. Gera / busca QR code quando desconectado
    const connectRes = await fetch(`${base}/instance/connect/${instance}`, {
      headers: evoHeaders(),
    })
    const connectData = await connectRes.json()

    // Evolution pode retornar: { code: "QR_CODE_BASE64" } ou { base64: "..." }
    const qrCode: string | null =
      connectData?.code ?? connectData?.base64 ?? connectData?.qrcode?.base64 ?? null

    return NextResponse.json({ state, qr: qrCode, instance })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro ao contactar Evolution API' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const base     = BASE_URL()
  const instance = INSTANCE()
  const { action } = await req.json().catch(() => ({ action: 'restart' }))

  if (!base || !API_KEY()) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 503 })
  }

  try {
    if (action === 'logout') {
      await fetch(`${base}/instance/logout/${instance}`, {
        method: 'DELETE',
        headers: evoHeaders(),
      })
      return NextResponse.json({ ok: true, action: 'logout' })
    }

    // restart: desconecta e pede novo QR
    await fetch(`${base}/instance/restart/${instance}`, {
      method: 'PUT',
      headers: evoHeaders(),
    }).catch(() => {})

    return NextResponse.json({ ok: true, action: 'restart' })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 502 })
  }
}
