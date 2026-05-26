import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listarModelos, type AIProvider } from '@/lib/glossario/ai-models'

/**
 * GET /api/glossario/models
 *
 * Lista todos os modelos disponíveis no catálogo, ordenados por
 * provedor e tier de custo (econômico → premium).
 *
 * Query params:
 *   ?provider=gemini|openai     filtra por provedor
 *   ?legacy=1                   inclui modelos legados
 *
 * Resposta:
 *   {
 *     modelos: [
 *       { id, provider, label, description, pricing, speed, quality, costTier, recommended, ideal }
 *     ],
 *     totalPorProvider: { gemini: 5, openai: 5 }
 *   }
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const provider = url.searchParams.get('provider') as AIProvider | null
  const incluirLegacy = url.searchParams.get('legacy') === '1'

  const modelos = listarModelos({
    provider: provider || undefined,
    incluirLegacy,
  }).sort((a, b) => {
    // Mesma ordem que a UI: provider → costTier → recomendado primeiro
    if (a.provider !== b.provider) return a.provider.localeCompare(b.provider)
    const tier: Record<string, number> = { economico: 0, medio: 1, premium: 2 }
    if (tier[a.costTier] !== tier[b.costTier]) return tier[a.costTier] - tier[b.costTier]
    if (a.recommended && !b.recommended) return -1
    if (!a.recommended && b.recommended) return 1
    return a.label.localeCompare(b.label)
  })

  const totalPorProvider = modelos.reduce<Record<string, number>>((acc, m) => {
    acc[m.provider] = (acc[m.provider] || 0) + 1
    return acc
  }, {})

  return NextResponse.json({ modelos, totalPorProvider })
}
