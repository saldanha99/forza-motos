/**
 * GET  /api/admin/whatsapp        → status + QR code da instância ativa + lista de instâncias
 * POST /api/admin/whatsapp        → criar instância | selecionar | reiniciar | logout
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BASE_URL = () => process.env.EVOLUTION_API_URL ?? ''
const API_KEY  = () => process.env.EVOLUTION_API_KEY ?? ''

function evoHeaders() {
  return { apikey: API_KEY(), 'Content-Type': 'application/json' }
}

async function getActiveInstance(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'evolution_instance' } })
    return setting?.value || process.env.EVOLUTION_INSTANCE || 'forza-motos'
  } catch {
    return process.env.EVOLUTION_INSTANCE || 'forza-motos'
  }
}

export async function GET() {
  const base = BASE_URL()
  if (!base || !API_KEY()) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 503 })
  }

  const instance = await getActiveInstance()

  try {
    // 1. Lista todas as instâncias
    const listRes = await fetch(`${base}/instance/fetchInstances`, {
      headers: evoHeaders(),
    })
    const listData = await listRes.json()
    const instancias: { name: string; state: string; ownerJid?: string }[] = (
      Array.isArray(listData) ? listData : []
    ).map((i: any) => ({
      name: i.instance?.instanceName ?? i.name ?? '',
      state: i.instance?.state ?? i.connectionStatus ?? 'unknown',
      ownerJid: i.ownerJid ?? i.instance?.ownerJid,
    }))

    // 2. Estado da instância ativa
    const stateRes = await fetch(`${base}/instance/connectionState/${instance}`, {
      headers: evoHeaders(),
    })
    const stateData = await stateRes.json()
    const state: string = stateData?.instance?.state ?? stateData?.state ?? 'unknown'

    if (state === 'open') {
      return NextResponse.json({ state: 'open', qr: null, instance, instancias })
    }

    // 3. QR code quando desconectado
    const connectRes = await fetch(`${base}/instance/connect/${instance}`, {
      headers: evoHeaders(),
    })
    const connectData = await connectRes.json()
    const qrCode: string | null =
      connectData?.code ?? connectData?.base64 ?? connectData?.qrcode?.base64 ?? null

    return NextResponse.json({ state, qr: qrCode, instance, instancias })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erro ao contactar Evolution API' }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const base = BASE_URL()
  if (!base || !API_KEY()) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const { action, instanceName } = body

  // ── Criar nova instância ───────────────────────────────────────────────────
  if (action === 'create') {
    const nome = (instanceName ?? '').trim()
    if (!nome) return NextResponse.json({ error: 'Nome da instância é obrigatório' }, { status: 400 })

    const res = await fetch(`${base}/instance/create`, {
      method: 'POST',
      headers: evoHeaders(),
      body: JSON.stringify({
        instanceName: nome,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.response?.message?.[0] ?? data?.message ?? 'Erro ao criar instância' },
        { status: res.status },
      )
    }

    // Seleciona automaticamente a nova instância
    await prisma.setting.upsert({
      where: { key: 'evolution_instance' },
      create: { key: 'evolution_instance', value: nome },
      update: { value: nome },
    })

    const qr = data?.qrcode?.base64 ?? data?.qrcode?.code ?? null
    return NextResponse.json({ ok: true, instance: nome, qr, data })
  }

  // ── Selecionar instância existente ─────────────────────────────────────────
  if (action === 'select') {
    const nome = (instanceName ?? '').trim()
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    await prisma.setting.upsert({
      where: { key: 'evolution_instance' },
      create: { key: 'evolution_instance', value: nome },
      update: { value: nome },
    })
    return NextResponse.json({ ok: true, instance: nome })
  }

  // ── Reiniciar instância ────────────────────────────────────────────────────
  if (action === 'restart') {
    const target = (instanceName ?? '') || (await getActiveInstance())
    await fetch(`${base}/instance/restart/${target}`, {
      method: 'PUT',
      headers: evoHeaders(),
    }).catch(() => {})
    return NextResponse.json({ ok: true, action: 'restart' })
  }

  // ── Logout / desconectar ───────────────────────────────────────────────────
  if (action === 'logout') {
    const target = (instanceName ?? '') || (await getActiveInstance())
    await fetch(`${base}/instance/logout/${target}`, {
      method: 'DELETE',
      headers: evoHeaders(),
    }).catch(() => {})
    return NextResponse.json({ ok: true, action: 'logout' })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
