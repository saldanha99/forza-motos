/**
 * POST /api/evolution/disconnect
 * Desconecta (logout) a instância WhatsApp.
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getInstanciaAtiva } from '@/lib/evolution/instancia'

const BASE_URL  = process.env.EVOLUTION_API_URL   ?? ''
const API_KEY   = process.env.EVOLUTION_API_KEY   ?? ''

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const INSTANCE = await getInstanciaAtiva()

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
