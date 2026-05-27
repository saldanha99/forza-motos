/**
 * GET /api/evolution/status
 * Retorna estado de conexão da instância WhatsApp.
 * Proxy server-side — API key nunca chega ao browser.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL  = process.env.EVOLUTION_API_URL   ?? ''
const API_KEY   = process.env.EVOLUTION_API_KEY   ?? ''
const INSTANCE  = process.env.EVOLUTION_INSTANCE  ?? 'forza-motos'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!BASE_URL || !API_KEY) {
    return NextResponse.json({ state: 'not_configured', instance: INSTANCE }, { status: 200 })
  }

  try {
    // 1. Verifica se a instância existe
    const stateRes = await fetch(`${BASE_URL}/instance/connectionState/${INSTANCE}`, {
      headers: { apikey: API_KEY },
      next: { revalidate: 0 },
    })

    if (stateRes.status === 404 || stateRes.status === 400) {
      // Instância não existe ainda
      return NextResponse.json({ state: 'not_found', instance: INSTANCE })
    }

    if (!stateRes.ok) {
      return NextResponse.json({ state: 'error', instance: INSTANCE, status: stateRes.status })
    }

    const data = await stateRes.json()
    // Evolution v2: { instance: { instanceName, state } }
    // Evolution v1: { state }
    const state: string =
      data?.instance?.state ??
      data?.state ??
      data?.instanceState ??
      'unknown'

    return NextResponse.json({ state, instance: INSTANCE })
  } catch (e) {
    return NextResponse.json({ state: 'error', instance: INSTANCE, error: String(e) })
  }
}
