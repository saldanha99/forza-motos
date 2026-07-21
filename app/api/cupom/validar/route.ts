/**
 * POST /api/cupom/validar — checa um cupom para o subtotal informado e devolve
 * o desconto (em reais). Só valida; o consumo do cupom acontece no /api/pedidos.
 */
import { NextResponse } from 'next/server'
import { validarCupom } from '@/lib/cupom'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const codigo = String(body.codigo ?? '')
  const subtotal = Number(body.subtotal ?? 0)

  if (!codigo || !Number.isFinite(subtotal) || subtotal <= 0) {
    return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  }

  const r = await validarCupom(codigo, subtotal)
  if ('erro' in r) return NextResponse.json({ erro: r.erro }, { status: 200 })
  return NextResponse.json(r, { status: 200 })
}
