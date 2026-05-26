/**
 * Analisador SEO de conteúdo — substitui o "Focus Keyword Score" do Rank Math.
 *
 * Dá uma nota de 0-100 e uma lista de melhorias para um texto/artigo,
 * baseado em heurísticas conhecidas:
 *
 *   - Densidade da keyword (ideal: 0.5%-2.5%)
 *   - Keyword no título, primeiro parágrafo, URL, headings
 *   - Comprimento do título (50-60 chars), meta description (140-160)
 *   - Quantidade de palavras (mínimo 300)
 *   - Quantidade de subtítulos (H2/H3)
 *   - Imagens com alt
 *   - Links internos e externos
 *
 * Uso:
 *   const score = analyzeSEO({
 *     focusKeyword: 'pneu de moto',
 *     title: 'Melhor Pneu de Moto 2025',
 *     metaDescription: '...',
 *     slug: 'melhor-pneu-de-moto',
 *     content: htmlOuMarkdown,
 *   })
 *
 *   // score.score = 87
 *   // score.checks = [{ ok: true, label: 'Keyword no título' }, ...]
 */

export interface SeoAnalysisInput {
  focusKeyword: string
  title: string
  metaDescription?: string
  slug?: string
  /** HTML ou texto plano */
  content: string
}

export interface SeoCheck {
  ok: boolean
  label: string
  hint?: string
  /** Peso na nota final (0-10). Padrão: 5 */
  weight?: number
}

export interface SeoAnalysisResult {
  score: number // 0-100
  checks: SeoCheck[]
  stats: {
    wordCount: number
    keywordDensity: number
    headingCount: number
    internalLinks: number
    externalLinks: number
    imageCount: number
    imagesWithAlt: number
  }
}

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das', 'e', 'ou',
  'que', 'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'se', 'é',
])

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0 && !STOPWORDS.has(w.toLowerCase())).length
}

function keywordOccurrences(text: string, keyword: string): number {
  if (!keyword) return 0
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b${escaped}\\b`, 'gi')
  return (text.match(re) || []).length
}

export function analyzeSEO(input: SeoAnalysisInput): SeoAnalysisResult {
  const { focusKeyword, title, metaDescription = '', slug = '', content } = input
  const kw = focusKeyword.trim().toLowerCase()
  const textOnly = stripHtml(content)
  const totalWords = textOnly.split(/\s+/).filter(Boolean).length

  const occurrences = keywordOccurrences(textOnly, kw)
  const density = totalWords > 0 ? (occurrences / totalWords) * 100 : 0

  // Stats de HTML
  const headings = (content.match(/<h[2-3]\b[^>]*>/gi) || []).length
  const internalLinks = (content.match(/<a\s[^>]*href=["']\/[^"']*["']/gi) || []).length
  const externalLinks = (content.match(/<a\s[^>]*href=["']https?:\/\/[^"']*["']/gi) || []).length
  const images = (content.match(/<img\b/gi) || []).length
  const imagesWithAlt = (content.match(/<img\b[^>]*alt=["'][^"']+["']/gi) || []).length

  const checks: SeoCheck[] = [
    {
      ok: kw !== '' && title.toLowerCase().includes(kw),
      label: 'Keyword no título',
      hint: `Inclua "${focusKeyword}" no título`,
      weight: 10,
    },
    {
      ok: title.length >= 30 && title.length <= 60,
      label: 'Título entre 30-60 caracteres',
      hint: `Atual: ${title.length}. Ideal: 50-60`,
      weight: 5,
    },
    {
      ok: metaDescription.length >= 120 && metaDescription.length <= 160,
      label: 'Meta description entre 120-160 chars',
      hint: `Atual: ${metaDescription.length}. Ideal: 140-160`,
      weight: 5,
    },
    {
      ok: kw !== '' && metaDescription.toLowerCase().includes(kw),
      label: 'Keyword na meta description',
      weight: 5,
    },
    {
      ok: kw !== '' && slug.toLowerCase().includes(kw.replace(/\s+/g, '-')),
      label: 'Keyword no slug/URL',
      weight: 7,
    },
    {
      ok: kw !== '' && textOnly.slice(0, 200).toLowerCase().includes(kw),
      label: 'Keyword no primeiro parágrafo',
      weight: 8,
    },
    {
      ok: density >= 0.5 && density <= 2.5,
      label: 'Densidade de keyword 0.5%-2.5%',
      hint: `Atual: ${density.toFixed(2)}%`,
      weight: 8,
    },
    {
      ok: totalWords >= 300,
      label: 'Conteúdo com 300+ palavras',
      hint: `Atual: ${totalWords}`,
      weight: 8,
    },
    {
      ok: totalWords >= 1000,
      label: 'Conteúdo robusto (1000+ palavras)',
      hint: `Atual: ${totalWords}`,
      weight: 5,
    },
    {
      ok: headings >= 2,
      label: '2+ subtítulos (H2/H3)',
      hint: `Atual: ${headings}`,
      weight: 6,
    },
    {
      ok: internalLinks >= 1,
      label: 'Ao menos 1 link interno',
      weight: 5,
    },
    {
      ok: externalLinks >= 1,
      label: 'Ao menos 1 link externo de autoridade',
      weight: 3,
    },
    {
      ok: images === 0 || imagesWithAlt === images,
      label: 'Todas as imagens com alt',
      hint: `${imagesWithAlt}/${images}`,
      weight: 5,
    },
  ]

  const totalWeight = checks.reduce((s, c) => s + (c.weight || 5), 0)
  const earned = checks.reduce((s, c) => s + (c.ok ? c.weight || 5 : 0), 0)
  const score = Math.round((earned / totalWeight) * 100)

  return {
    score,
    checks,
    stats: {
      wordCount: totalWords,
      keywordDensity: Number(density.toFixed(2)),
      headingCount: headings,
      internalLinks,
      externalLinks,
      imageCount: images,
      imagesWithAlt,
    },
  }
}
