import { prisma } from '@/lib/prisma'

/**
 * Auto-link de termos do glossário em qualquer HTML.
 *
 * Substitui a primeira ocorrência de cada termo no texto por um link
 * apontando para /glossario/[slug]. Útil para internal linking automático
 * (boa prática de SEO).
 *
 * Uso em uma página de blog ou produto:
 *
 *   const conteudoComLinks = await autoLinkGlossario(post.conteudo)
 *   <div dangerouslySetInnerHTML={{ __html: conteudoComLinks }} />
 *
 * Recomendação: faça cache no fetch dos termos (ISR / unstable_cache).
 */

let cacheTermos: Array<{ termo: string; slug: string }> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 1000 * 60 * 60 // 1 hora

async function getTermosPublicados() {
  const agora = Date.now()
  if (cacheTermos && agora - cacheTimestamp < CACHE_TTL) {
    return cacheTermos
  }
  const termos = await prisma.glossaryTerm.findMany({
    where: { publicado: true },
    select: { termo: true, slug: true },
    orderBy: { termo: 'desc' }, // termos mais longos primeiro
  })
  // Ordena por tamanho do termo (descendente) para evitar match parcial
  termos.sort((a, b) => b.termo.length - a.termo.length)
  cacheTermos = termos
  cacheTimestamp = agora
  return termos
}

/** Limpa o cache (chamar após criar/editar termos no admin) */
export function invalidarCacheAutoLink() {
  cacheTermos = null
  cacheTimestamp = 0
}

export async function autoLinkGlossario(
  html: string,
  opcoes: {
    /** Pular este slug (evita auto-link na própria página do termo) */
    excluirSlug?: string
    /** Máximo de links por termo no texto (default: 1) */
    maxPorTermo?: number
    /** CSS class do link */
    className?: string
  } = {}
): Promise<string> {
  const { excluirSlug, maxPorTermo = 1, className = 'glossary-link' } = opcoes
  const termos = await getTermosPublicados()
  if (termos.length === 0) return html

  let resultado = html
  const jaLinkado: Record<string, number> = {}

  for (const { termo, slug } of termos) {
    if (excluirSlug && slug === excluirSlug) continue
    if ((jaLinkado[slug] || 0) >= maxPorTermo) continue

    // Regex: word boundary, case-insensitive, ignora se já estiver dentro de <a>
    const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Negative lookbehind: não trocar se vier após `>` que faz parte de tag aberta de link
    // ou se já estiver dentro de <a>...</a>. Estratégia simples: ignorar trechos dentro de <a>.
    const regex = new RegExp(`\\b(${escaped})\\b`, 'i')

    // Encontra a primeira ocorrência fora de tags <a>
    resultado = substituirForaDeTags(resultado, regex, (match) => {
      jaLinkado[slug] = (jaLinkado[slug] || 0) + 1
      return `<a href="/glossario/${slug}" class="${className}" title="Saiba mais: ${termo}">${match}</a>`
    })
  }

  return resultado
}

/** Substitui apenas a primeira ocorrência de `regex` que NÃO esteja dentro de <a>...</a> */
function substituirForaDeTags(
  html: string,
  regex: RegExp,
  replacer: (match: string) => string
): string {
  // Divide o HTML em segmentos: dentro de <a>...</a> vs fora
  const partes: Array<{ texto: string; dentroLink: boolean }> = []
  const re = /<a\b[^>]*>[\s\S]*?<\/a>/gi
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m.index > lastIdx) {
      partes.push({ texto: html.slice(lastIdx, m.index), dentroLink: false })
    }
    partes.push({ texto: m[0], dentroLink: true })
    lastIdx = m.index + m[0].length
  }
  if (lastIdx < html.length) {
    partes.push({ texto: html.slice(lastIdx), dentroLink: false })
  }

  // Aplica substituição apenas em partes "fora de link"
  let jaSubstituiu = false
  return partes
    .map((p) => {
      if (jaSubstituiu || p.dentroLink) return p.texto
      const match = p.texto.match(regex)
      if (!match) return p.texto
      jaSubstituiu = true
      return p.texto.replace(regex, (m) => replacer(m))
    })
    .join('')
}
