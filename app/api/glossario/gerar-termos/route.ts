/**
 * POST /api/glossario/gerar-termos
 *
 * Sugere entre 15–30 nomes de termos para uma letra e nicho via IA.
 * Salva no banco como status "pendente" (sem conteúdo ainda).
 *
 * Body: { nicho, letra, prefixo?, promptExtra?, provider?, modelo?, maxTokens?, apiKey? }
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { assertLicense, LicenseError } from '@/lib/license'
import { prisma } from '@/lib/prisma'
import { gerarSlug } from '@/lib/glossario/queries'
import { callAI, cleanJsonResponse } from '@/lib/glossario/multi-provider'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Trava de licenca 2time SEO
  try {
    await assertLicense(req.headers.get('host'))
  } catch (e) {
    if (e instanceof LicenseError) return NextResponse.json({ error: e.message }, { status: 403 })
    throw e
  }

  const body = await req.json().catch(() => ({}))
  const {
    nicho,
    letra,
    prefixo     = 'Nenhum',
    promptExtra = '',
    provider,
    modelo,
    quantidade  = 100,
    maxTokens,
    apiKey,
  } = body

  // 100 termos não cabem em 1024 tokens — escala o teto pela quantidade pedida
  const qtd = Math.max(10, Math.min(200, Number(quantidade) || 100))
  const tokens = maxTokens ?? Math.min(8000, 1200 + qtd * 40)

  if (!nicho?.trim() || !letra?.trim()) {
    return NextResponse.json({ error: '"nicho" e "letra" são obrigatórios' }, { status: 400 })
  }

  const letraMaiuscula = letra.toUpperCase().trim().charAt(0)

  const formatacaoPrefixo = prefixo !== 'Nenhum'
    ? `Formate cada termo iniciando obrigatoriamente com o prefixo "${prefixo}".
Por exemplo, para a letra "${letraMaiuscula}" no nicho "${nicho}", gere termos exatamente no formato:
"${prefixo} [Palavra que começa com ${letraMaiuscula}]" — a palavra principal DEVE começar com "${letraMaiuscula}".`
    : `Não utilize nenhum prefixo. Gere apenas os termos simples, cada um começando estritamente com a letra "${letraMaiuscula}".`

  const prompt = `Você é um especialista em SEO, Marketing Digital e criação de glossários corporativos altamente indexáveis no Google.
Gere uma lista de termos, palavras-chave e expressões de mercado relacionadas ao nicho "${nicho}".

${formatacaoPrefixo}

IMPORTANTE: Não use aspas duplas de forma alguma dentro do texto de cada termo sugerido. Use apenas aspas simples caso precise destacar algum nome. Isso é necessário para evitar corromper a estrutura JSON.
Retorne estritamente um objeto JSON no formato:
{"termos": ["Termo 1", "Termo 2", ...]}

Gere exatamente ${qtd} termos altamente relevantes para ranqueamento no Google, sem repetir.
${promptExtra ? `Instruções adicionais: ${promptExtra}` : ''}`

  try {
    const raw     = await callAI({ prompt, maxTokens: tokens, provider, modelo, apiKey: apiKey || undefined })
    const cleaned = cleanJsonResponse(raw)
    const parsed  = JSON.parse(cleaned)
    const sugeridos: string[] = parsed.termos ?? []

    if (!Array.isArray(sugeridos) || sugeridos.length === 0) {
      return NextResponse.json({ error: 'IA não retornou termos válidos' }, { status: 500 })
    }

    // Insere em lote ignorando duplicatas de slug
    const payload = sugeridos
      .filter((t) => t?.trim())
      .map((t) => ({
        termo:     t.trim(),
        slug:      gerarSlug(t.trim()),
        letra:     letraMaiuscula,
        nicho:     nicho.trim(),
        conteudo:  '',          // será preenchido por gerar-conteudo
        publicado: false,
        origem:    'AI_GEMINI' as const, // sobrescrito pelo provider real
      }))

    // upsert ignorando duplicatas
    let inseridos = 0
    for (const p of payload) {
      try {
        await prisma.glossaryTerm.create({ data: p })
        inseridos++
      } catch {
        // slug duplicado — ignora silenciosamente
      }
    }

    return NextResponse.json({
      success:        true,
      totalSugeridos: sugeridos.length,
      totalInseridos: inseridos,
    })
  } catch (e: any) {
    console.error('[gerar-termos]', e?.message)
    return NextResponse.json({ error: e?.message || 'Erro ao gerar termos' }, { status: 500 })
  }
}
