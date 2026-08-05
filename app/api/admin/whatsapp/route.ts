/**
 * GET  /api/admin/whatsapp  → estado + QR da instância ativa + instâncias do Forza
 * POST /api/admin/whatsapp  → create | select | restart | logout | delete
 *
 * ─── Isolamento entre clientes ──────────────────────────────────────────────
 * A Evolution API é compartilhada com outros clientes e a chave usada aqui é a
 * GLOBAL: `fetchInstances` devolve TODAS as instâncias do servidor, com nome e
 * `ownerJid` (o número de WhatsApp) de terceiros.
 *
 * Por isso duas regras valem para tudo neste arquivo:
 *   1. Só sessão ADMIN entra.
 *   2. Nenhuma instância fora do escopo do Forza é listada, e nenhuma ação
 *      pode apontar para ela — o alvo é validado no servidor, nunca no cliente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolverQrDataUri } from '@/lib/evolution/qr'

export const dynamic = 'force-dynamic'

const BASE_URL = () => process.env.EVOLUTION_API_URL ?? ''
const API_KEY = () => process.env.EVOLUTION_API_KEY ?? ''

/** Prefixo que marca uma instância como sendo deste cliente. */
const PREFIXO = () => (process.env.EVOLUTION_INSTANCE_PREFIX ?? 'forza').toLowerCase()

function evoHeaders() {
  return { apikey: API_KEY(), 'Content-Type': 'application/json' }
}

async function instanciaAtiva(): Promise<string> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'evolution_instance' } })
    return setting?.value || process.env.EVOLUTION_INSTANCE || 'forza-motos'
  } catch {
    return process.env.EVOLUTION_INSTANCE || 'forza-motos'
  }
}

/**
 * A instância pertence ao Forza?
 *
 * Vale por prefixo ou por ser exatamente a que está configurada — a segunda
 * condição cobre uma instância legada com nome fora do padrão.
 */
function ehDoForza(nome: string, ativa: string): boolean {
  const n = (nome ?? '').trim().toLowerCase()
  if (!n) return false
  const p = PREFIXO()
  // Exige o prefixo inteiro seguido de separador (ou o nome ser só o prefixo).
  // `startsWith(p)` sozinho deixaria passar "forzaria-de-outro-cliente".
  return n === ativa.trim().toLowerCase() || n === p || n.startsWith(`${p}-`)
}

/** Guarda de sessão — devolve a resposta de erro, ou null se pode seguir. */
async function exigirAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }
  return null
}

/* ═══════════════════════════════════════════════════════════════════
   GET
   ═══════════════════════════════════════════════════════════════════ */

export async function GET() {
  const negado = await exigirAdmin()
  if (negado) return negado

  const base = BASE_URL()
  if (!base || !API_KEY()) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 503 })
  }

  const instance = await instanciaAtiva()

  try {
    const listRes = await fetch(`${base}/instance/fetchInstances`, { headers: evoHeaders() })
    const listData = await listRes.json()
    const todas: any[] = Array.isArray(listData) ? listData : []

    // O filtro acontece AQUI, no servidor. Mandar a lista inteira e esconder no
    // front deixaria os dados de terceiros trafegando na resposta.
    const instancias = todas
      .map((i: any) => ({
        name: i.instance?.instanceName ?? i.name ?? '',
        state: i.instance?.state ?? i.connectionStatus ?? 'unknown',
        ownerJid: i.ownerJid ?? i.instance?.ownerJid ?? null,
      }))
      .filter((i) => ehDoForza(i.name, instance))

    const ocultas = todas.length - instancias.length

    const stateRes = await fetch(`${base}/instance/connectionState/${instance}`, {
      headers: evoHeaders(),
    })
    const stateData = await stateRes.json()
    const state: string = stateData?.instance?.state ?? stateData?.state ?? 'unknown'

    if (state === 'open') {
      return NextResponse.json({ state, qr: null, instance, instancias, ocultas })
    }

    const connectRes = await fetch(`${base}/instance/connect/${instance}`, {
      headers: evoHeaders(),
    })
    const connectData = await connectRes.json()
    // Devolve sempre data URI pronto — o cliente não precisa adivinhar formato.
    const qrCode = await resolverQrDataUri(connectData)

    return NextResponse.json({ state, qr: qrCode, instance, instancias, ocultas })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? 'Erro ao contactar Evolution API' },
      { status: 502 },
    )
  }
}

/* ═══════════════════════════════════════════════════════════════════
   POST
   ═══════════════════════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  const negado = await exigirAdmin()
  if (negado) return negado

  const base = BASE_URL()
  if (!base || !API_KEY()) {
    return NextResponse.json({ error: 'Evolution API não configurada' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const { action, instanceName } = body as { action?: string; instanceName?: string }
  const ativa = await instanciaAtiva()

  /** Resolve e valida o alvo. Nunca confia no nome que veio do cliente. */
  function alvoValido(nome?: string) {
    const target = (nome ?? '').trim() || ativa
    return ehDoForza(target, ativa) ? target : null
  }

  const proibido = () =>
    NextResponse.json({ error: 'Essa instância não pertence a este painel.' }, { status: 403 })

  /* ── Criar ─────────────────────────────────────────────────────── */
  if (action === 'create') {
    let nome = (instanceName ?? '').trim().toLowerCase()
    if (!nome) {
      return NextResponse.json({ error: 'Nome da instância é obrigatório' }, { status: 400 })
    }
    if (!/^[a-z0-9-]+$/.test(nome)) {
      return NextResponse.json(
        { error: 'Use apenas letras minúsculas, números e hífen.' },
        { status: 400 },
      )
    }
    // Prefixo imposto no servidor: sem isso daria para criar instância fora do
    // escopo do Forza e passar a administrá-la por aqui.
    if (!nome.startsWith(PREFIXO())) nome = `${PREFIXO()}-${nome}`

    const res = await fetch(`${base}/instance/create`, {
      method: 'POST',
      headers: evoHeaders(),
      body: JSON.stringify({ instanceName: nome, integration: 'WHATSAPP-BAILEYS', qrcode: true }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.response?.message?.[0] ?? data?.message ?? 'Erro ao criar instância' },
        { status: res.status },
      )
    }

    await prisma.setting.upsert({
      where: { key: 'evolution_instance' },
      create: { key: 'evolution_instance', value: nome },
      update: { value: nome },
    })

    const qr = data?.qrcode?.base64 ?? data?.qrcode?.code ?? null
    return NextResponse.json({ ok: true, instance: nome, qr })
  }

  /* ── Selecionar ────────────────────────────────────────────────── */
  if (action === 'select') {
    const target = alvoValido(instanceName)
    if (!target) return proibido()

    await prisma.setting.upsert({
      where: { key: 'evolution_instance' },
      create: { key: 'evolution_instance', value: target },
      update: { value: target },
    })
    return NextResponse.json({ ok: true, instance: target })
  }

  /* ── Reiniciar ─────────────────────────────────────────────────── */
  if (action === 'restart') {
    const target = alvoValido(instanceName)
    if (!target) return proibido()

    await fetch(`${base}/instance/restart/${target}`, {
      method: 'PUT',
      headers: evoHeaders(),
    }).catch(() => {})
    return NextResponse.json({ ok: true, action: 'restart', instance: target })
  }

  /* ── Desconectar ───────────────────────────────────────────────── */
  if (action === 'logout') {
    const target = alvoValido(instanceName)
    if (!target) return proibido()

    await fetch(`${base}/instance/logout/${target}`, {
      method: 'DELETE',
      headers: evoHeaders(),
    }).catch(() => {})
    return NextResponse.json({ ok: true, action: 'logout', instance: target })
  }

  /* ── Excluir ───────────────────────────────────────────────────── */
  if (action === 'delete') {
    const target = alvoValido(instanceName)
    if (!target) return proibido()

    // A Evolution recusa apagar instância conectada — desconecta antes.
    await fetch(`${base}/instance/logout/${target}`, {
      method: 'DELETE',
      headers: evoHeaders(),
    }).catch(() => {})

    const res = await fetch(`${base}/instance/delete/${target}`, {
      method: 'DELETE',
      headers: evoHeaders(),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.response?.message?.[0] ?? data?.message ?? 'Erro ao excluir instância' },
        { status: res.status },
      )
    }

    // Se a excluída era a ativa, o painel ficaria apontando para o vazio.
    if (target.toLowerCase() === ativa.toLowerCase()) {
      const padrao = process.env.EVOLUTION_INSTANCE || 'forza-motos'
      await prisma.setting.upsert({
        where: { key: 'evolution_instance' },
        create: { key: 'evolution_instance', value: padrao },
        update: { value: padrao },
      })
    }

    return NextResponse.json({ ok: true, action: 'delete', instance: target })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
