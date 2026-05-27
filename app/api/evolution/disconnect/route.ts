/**
 * POST /api/evolution/disconnect
 * Desconecta (logout) a instância WhatsApp.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BASE_URL  = process.env.EVOLUTION_API_URL   ?? ''
const API_KEY   = process.env.EVOLUTION_API_KEY   ?? ''
const INSTANCE  = process.env.EVOLUTION_INSTANCE  ?? 'forza-motos'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const res = await fetch(`${BASE_URL}/instance/logout/${INSTANCE}`, {
      method: 'DELETE',
      headers: { apikey: API_KEY },
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, ...data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
