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

// Cotação sempre ao vivo — cache guardava resultado velho e o cliente via
// só "retirar na loja" ao voltar do checkout (bug relatado na reunião de 20/07)
export const dynamic = 'force-dynamic'

// Dimensões médias de um pedido de pneu/peça
const DIMENSOES_PADRAO = dimensoesPorCategoria('pneus')

const SEM_CACHE = { 'Cache-Control': 'no-store, must-revalidate' }

export async function GET(req: NextRequest) {
  const cep      = req.nextUrl.searchParams.get('cep')?.replace(/\D/g, '') ?? ''
  // Serve apenas para estimativa em páginas de produto. A confirmação do
  // checkout usa /api/frete/cotar, que recalcula o valor pelo banco.
  const valorDeclarado = Math.max(
    0,
    Math.min(Number(req.nextUrl.searchParams.get('subtotal') ?? 0) || 0, 100_000),
  )

  if (cep.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido' }, { status: 400 })
  }

  try {
    const resultados = await cotarMelhorEnvio({
      cepDestino: cep,
      dimensoes:  DIMENSOES_PADRAO,
      valorTotal: valorDeclarado,
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
      .slice(0, 2) // PAC e SEDEX, quando disponíveis para a rota

    // retirada na loja sempre disponível, além do limite das 4
    const opcoes = [
      ...transportadoras,
      opcaoRetirada(),
    ]

    return NextResponse.json({ opcoes }, { headers: SEM_CACHE })
  } catch (err: any) {
    console.error('[frete/calcular]', err?.message)
    // Melhor Envio fora do ar: ainda oferece retirada na loja, não deixa o
    // cliente sem NENHUMA opção de entrega
    return NextResponse.json({ opcoes: [opcaoRetirada()] }, { headers: SEM_CACHE })
  }
}
