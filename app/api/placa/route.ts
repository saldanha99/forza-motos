/**
 * POST /api/placa — identifica a moto pela placa e indica produtos compatíveis.
 * Público (usado na vitrine), com rate-limit por IP para proteger os créditos
 * da API paga. Cache no banco garante que placa repetida não gasta crédito.
 */
import { NextResponse } from 'next/server'
import { consultarPlaca, normalizarPlaca } from '@/lib/placa'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Rate limit simples em memória: 5 consultas/min por IP
const janela = new Map<string, number[]>()
function permitido(ip: string): boolean {
  const agora = Date.now()
  const hits = (janela.get(ip) ?? []).filter((t) => agora - t < 60_000)
  if (hits.length >= 5) return false
  hits.push(agora)
  janela.set(ip, hits)
  if (janela.size > 5000) janela.clear() // proteção de memória
  return true
}

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'anon'
  if (!permitido(ip)) {
    return NextResponse.json(
      { error: 'Muitas consultas — aguarde um minuto e tente de novo.' },
      { status: 429 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const placa = normalizarPlaca(String(body.placa ?? ''))
  if (!placa) {
    return NextResponse.json(
      { error: 'Placa inválida. Use o formato ABC1234 ou ABC1D23.' },
      { status: 400 },
    )
  }

  try {
    const resultado = await consultarPlaca(placa)
    if (!resultado) {
      return NextResponse.json(
        { error: 'Não encontramos essa placa. Confira e tente novamente.' },
        { status: 404 },
      )
    }
    return NextResponse.json(resultado)
  } catch (e: any) {
    console.error('[placa]', e.message)
    return NextResponse.json(
      { error: 'Serviço de placas indisponível no momento. Tente pela medida do pneu ou modelo da moto.' },
      { status: 502 },
    )
  }
}
