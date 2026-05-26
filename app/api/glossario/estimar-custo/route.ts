import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { estimarCusto, compararCustos } from '@/lib/glossario/ai-models'

/**
 * POST /api/glossario/estimar-custo
 *
 * Estima quanto vai custar gerar N termos. Use ANTES de subir o CSV
 * com 500 termos para evitar surpresa na fatura.
 *
 * Body:
 *   {
 *     "quantidade": 500,
 *     "modeloId": "gemini-2.0-flash"      // opcional — se omitido, retorna comparação de todos
 *     "inputTokensPorTermo": 350,         // opcional
 *     "outputTokensPorTermo": 1800,       // opcional
 *     "cotacaoUSD": 5.50                  // opcional
 *   }
 *
 * Resposta com `modeloId`: estimativa única para aquele modelo.
 * Resposta sem `modeloId`: comparação ordenada do mais barato ao mais caro.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const {
    quantidade,
    modeloId,
    inputTokensPorTermo,
    outputTokensPorTermo,
    cotacaoUSD = 5.5,
  } = body

  if (!quantidade || quantidade < 1) {
    return NextResponse.json(
      { error: 'Campo "quantidade" obrigatório e >= 1' },
      { status: 400 }
    )
  }

  try {
    if (modeloId) {
      const estimativa = estimarCusto(
        { modeloId, quantidade, inputTokensPorTermo, outputTokensPorTermo },
        cotacaoUSD
      )
      return NextResponse.json({ estimativa })
    }

    // Sem modelo específico → compara todos
    const comparacao = compararCustos(quantidade, cotacaoUSD)
    return NextResponse.json({
      quantidade,
      cotacaoUSD,
      comparacao: comparacao.map((c) => ({
        modeloId: c.modelo.id,
        modeloLabel: c.modelo.label,
        provider: c.modelo.provider,
        costTier: c.modelo.costTier,
        quality: c.modelo.quality,
        recommended: c.modelo.recommended,
        custoTotalUSD: Number(c.custoTotalUSD.toFixed(4)),
        custoTotalBRL: Number(c.custoTotalBRL.toFixed(2)),
        custoPorTermoBRL: Number(c.custoPorTermoBRL.toFixed(4)),
      })),
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 400 }
    )
  }
}
