import { NextResponse } from 'next/server'
import { cotarFrete, ErroCotacaoFrete } from '@/lib/frete/cotar'

export const dynamic = 'force-dynamic'

const SEM_CACHE = { 'Cache-Control': 'no-store, must-revalidate' }

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
 *     ]
 *   }
 *
 * Resposta:
 *   {
 *     "opcoes": [
 *       { "id": "1", "nome": "PAC", "transportadora": "Correios", "logo": "...", "preco": 24.50, "prazo": 7, "fonte": "melhor-envio" },
 *       { "id": "2", "nome": "SEDEX", "transportadora": "Correios", ..., "preco": 38.90, "prazo": 3 },
 *       { "id": "retirada", "nome": "Retirar na loja", "transportadora": "R. Funilense, 110 — Campinas/SP", "preco": 0, "prazo": 0, "fonte": "loja" }
 *     ]
 *   }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { cepDestino, items } = body

    if (!cepDestino || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'cepDestino e items são obrigatórios' },
        { status: 400, headers: SEM_CACHE }
      )
    }

    const opcoes = await cotarFrete({
      cepDestino: String(cepDestino),
      items,
    })

    return NextResponse.json({ opcoes }, { headers: SEM_CACHE })
  } catch (e: unknown) {
    const status = e instanceof ErroCotacaoFrete ? e.status : 500
    const mensagem = e instanceof Error ? e.message : 'Erro ao cotar frete'
    if (status >= 500) console.error('[frete/cotar]', mensagem)
    return NextResponse.json(
      { error: status >= 500 ? 'Erro ao cotar frete' : mensagem },
      { status, headers: SEM_CACHE }
    )
  }
}
