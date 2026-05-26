import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateGlossaryTerm } from '@/lib/glossario/ai-providers'
import { criarTermo } from '@/lib/glossario/queries'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'

/**
 * POST /api/glossario/generate
 *
 * Body:
 *   { termo: string, nicho: string, provider?: 'gemini'|'openai',
 *     modelo?: string, publicar?: boolean, promptExtra?: string }
 *
 * Gera 1 termo via IA e (opcionalmente) já publica.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { termo, nicho, provider, modelo, publicar = false, promptExtra } = body

  if (!termo || !nicho) {
    return NextResponse.json(
      { error: 'Campos "termo" e "nicho" são obrigatórios' },
      { status: 400 }
    )
  }

  try {
    const gerado = await generateGlossaryTerm({
      termo,
      nicho,
      provider,
      modelo,
      promptExtra,
    })

    const criado = await criarTermo({
      termo,
      conteudo: gerado.conteudo,
      resumo: gerado.resumo,
      origem: gerado.provider === 'openai' ? 'AI_OPENAI' : 'AI_GEMINI',
      publicado: publicar,
    })

    // 🚀 Notifica Google + Bing imediatamente se já foi publicado
    if (publicar) {
      triggerIndexing(`${SEO_CONFIG.siteUrl}/glossario/${criado.slug}`, {
        action: 'URL_UPDATED',
        origem: 'admin-generate',
      })
    }

    return NextResponse.json({
      id: criado.id,
      slug: criado.slug,
      preview: gerado.resumo,
      provider: gerado.provider,
      modelo: gerado.modelo,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    )
  }
}
