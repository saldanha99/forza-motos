import { NextResponse } from 'next/server'
import { calcularFrete } from '@/lib/correios'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const cep = searchParams.get('cep')
  const peso = Number(searchParams.get('peso') ?? 1)
  const valor = Number(searchParams.get('valor') ?? 0)

  if (!cep) {
    return NextResponse.json({ error: 'CEP obrigatório' }, { status: 400 })
  }

  try {
    const opcoes = await calcularFrete(cep, peso, valor)
    return NextResponse.json(opcoes)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
