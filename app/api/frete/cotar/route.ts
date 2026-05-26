import { NextResponse } from 'next/server'
import { cotarFrete } from '@/lib/frete/cotar'

/**
 * POST /api/frete/cotar
 *
 * Cota opções de frete para um CEP destino + carrinho.
 *
 * Body:
 *   {
 *     "cepDestino": "01310100",
 *     "items": [
 *       { "productId": "cm...", "quantidade": 2 },
 *       { "productId": "cm...", "quantidade": 1 }
 *     ],
 *     "valorTotal": 489.90
 *   }
 *
 * Resposta:
 *   {
 *     "opcoes": [
 *       { "id": "1", "nome": "PAC", "transportadora": "Correios", "logo": "...", "preco": 24.50, "prazo": 7, "fonte": "melhor-envio" },
 *       { "id": "2", "nome": "SEDEX", "transportadora": "Correios", ..., "preco": 38.90, "prazo": 3 },
 *       { "id": "3", "nome": ".Package", "transportadora": "Jadlog", ..., "preco": 28.50, "prazo": 4 }
 *     ]
 *   }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { cepDestino, items, valorTotal } = body

    if (!cepDestino || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'cepDestino e items são obrigatórios' },
        { status: 400 }
      )
    }

    const opcoes = await cotarFrete({
      cepDestino: String(cepDestino),
      items: items.map((i: any) => ({
        productId: String(i.productId),
        quantidade: Number(i.quantidade),
      })),
      valorTotal: Number(valorTotal || 0),
    })

    return NextResponse.json({ opcoes })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Erro ao cotar frete' },
      { status: 500 }
    )
  }
}
