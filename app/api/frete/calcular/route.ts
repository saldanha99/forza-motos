/**
 * GET /api/frete/calcular?cep=13073041&subtotal=299
 *
 * Cotação rápida via Melhor Envio usando dimensões médias por fallback.
 * Usado pelo CalculadorFrete no frontend (produto e carrinho).
 * Para cotação precisa por produto, use POST /api/frete/cotar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cotarMelhorEnvio } from '@/lib/frete/melhor-envio'
import { dimensoesPorCategoria } from '@/lib/frete/dimensoes'
import { opcaoRetirada } from '@/lib/frete/cotar'

// Dimensões médias de um pedido de pneu/peça
const DIMENSOES_PADRAO = dimensoesPorCategoria('pneus')

export async function GET(req: NextRequest) {
  const cep      = req.nextUrl.searchParams.get('cep')?.replace(/\D/g, '') ?? ''
  const subtotal = Number(req.nextUrl.searchParams.get('subtotal') ?? 0)

  if (cep.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido' }, { status: 400 })
  }

  try {
    const resultados = await cotarMelhorEnvio({
      cepDestino: cep,
      dimensoes:  DIMENSOES_PADRAO,
      valorTotal: subtotal,
    })

    const transportadoras = resultados
      .filter((r) => r.available && r.price > 0)
      .map((r) => ({
        id:             String(r.id),
        nome:           r.name,
        transportadora: r.company,
        logo:           r.picture as string | undefined,
        preco:          r.price,
        prazo:          r.deliveryTime,
      }))
      .sort((a, b) => a.preco - b.preco)
      .slice(0, 4) // máximo 4 opções de transportadora

    // retirada na loja sempre disponível, além do limite das 4
    const opcoes = [...transportadoras, opcaoRetirada()]

    return NextResponse.json({ opcoes })
  } catch (err: any) {
    console.error('[frete/calcular]', err?.message)
    // Melhor Envio fora do ar: ainda oferece retirada na loja, não deixa o
    // cliente sem NENHUMA opção de entrega
    return NextResponse.json({ opcoes: [opcaoRetirada()] })
  }
}
