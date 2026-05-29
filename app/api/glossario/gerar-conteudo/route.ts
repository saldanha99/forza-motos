/**
 * POST /api/glossario/gerar-conteudo
 *
 * Gera (ou regera) o conteúdo HTML de um termo existente via IA
 * e publica automaticamente.
 *
 * Body: { id, provider?, modelo? }
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { triggerIndexing } from '@/lib/seo/indexing'
import { SEO_CONFIG } from '@/lib/seo/config'
import { callAI, cleanJsonResponse } from '@/lib/glossario/multi-provider'

const SITE_CIDADE = 'Campinas, SP'
const SITE_NOME   = 'Forza Motos'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { id, provider, modelo, maxTokens = 4096, apiKey } = body

  if (!id) {
    return NextResponse.json({ error: '"id" é obrigatório' }, { status: 400 })
  }

  const termo = await prisma.glossaryTerm.findUnique({ where: { id } })
  if (!termo) {
    return NextResponse.json({ error: 'Termo não encontrado' }, { status: 404 })
  }

  const nicho = termo.nicho || 'pneus, peças e acessórios para motos'

  const prompt = `Você é um redator sênior especialista em SEO local, Marketing de Busca e produção de conteúdo de alto valor para lojas de moto.
Escreva uma definição/verbete de dicionário extremamente detalhado (formato mini-artigo de blog) para o termo abaixo.

Termo: "${termo.termo}"
Nicho/Contexto: "${nicho}"
Foco Geográfico: ${SITE_CIDADE} e região

Instruções:
1. Artigo completo, longo e detalhado (mínimo 400 palavras).
2. Use tags HTML <h2> para seções. Cada <h2> deve ter ao menos um parágrafo de 100–150 palavras.
3. Exemplos de seções adequadas:
   - <h2>O que significa ${termo.termo}</h2>
   - <h2>Como funciona ${termo.termo} em ${SITE_CIDADE}</h2>
   - <h2>Vantagens de conhecer ${termo.termo}</h2>
   - <h2>Como escolher em ${SITE_CIDADE}</h2>
4. NUNCA use textos inacabados, reticências ou placeholders.
5. Não use markdown (#, ##). Não use <html>, <body>, <div>.
6. Inclua referências geográficas naturais (Campinas, SP, região de Campinas).
7. Tom profissional, técnico e acessível.
8. NÃO adicione introduções formais nem conclusões genéricas.

Retorne APENAS um objeto JSON válido:
{
  "conteudo": "HTML completo com <h2> e <p>",
  "seoTitle": "título SEO até 60 chars com o termo e ${SITE_CIDADE}",
  "resumo": "meta description até 155 chars com chamada para ação"
}`

  try {
    const raw     = await callAI({ prompt, maxTokens, provider, modelo, apiKey: apiKey || undefined })
    const cleaned = cleanJsonResponse(raw)
    const parsed  = JSON.parse(cleaned)

    const { conteudo, seoTitle, resumo } = parsed

    if (!conteudo?.trim()) {
      return NextResponse.json({ error: 'Conteúdo gerado está vazio' }, { status: 500 })
    }

    const updated = await prisma.glossaryTerm.update({
      where: { id },
      data:  {
        conteudo:  conteudo.trim(),
        seoTitle:  seoTitle?.trim() || `${termo.termo} — ${SITE_NOME}`,
        resumo:    resumo?.trim()   || `Saiba o que é ${termo.termo} no glossário da ${SITE_NOME} em ${SITE_CIDADE}.`,
        publicado: true,
        revisado:  false,
        origem:    'AI_GEMINI', // provider real é sobrescrito na lib
        updatedAt: new Date(),
      },
    })

    // Indexa no Google + Bing
    triggerIndexing(`${SEO_CONFIG.siteUrl}/glossario/${updated.slug}`, {
      action: 'URL_UPDATED',
      origem: 'admin-gerar-conteudo',
    })

    return NextResponse.json({ success: true, termo: updated })
  } catch (e: any) {
    console.error('[gerar-conteudo]', e?.message)
    return NextResponse.json({ error: e?.message || 'Erro ao gerar conteúdo' }, { status: 500 })
  }
}
