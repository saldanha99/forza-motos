/**
 * Divide o HTML do conteúdo do glossário em duas partes para injetar um CTA
 * no meio, SEM quebrar tags no meio.
 *
 * Estratégia: prefere quebrar imediatamente antes do <h2> mais próximo da
 * metade do conteúdo (mantém seções íntegras). Se não houver <h2> adequado,
 * cai para o fechamento de parágrafo </p> mais próximo do meio. Se o conteúdo
 * for muito curto, não divide (retorna tudo na primeira parte).
 */
export function dividirConteudoNoMeio(html: string): [string, string] {
  if (!html || html.length < 800) return [html, '']

  const meio = Math.floor(html.length / 2)

  /** Coleta índices de todos os matches de um regex global (sem iterar matchAll) */
  function indicesDe(regex: RegExp, offset = 0): number[] {
    const out: number[] = []
    let m: RegExpExecArray | null
    regex.lastIndex = 0
    while ((m = regex.exec(html)) !== null) {
      out.push(m.index + offset)
      if (m.index === regex.lastIndex) regex.lastIndex++ // evita loop em match vazio
    }
    return out
  }

  // 1) Tenta quebrar antes de um <h2> próximo ao meio
  const h2s = indicesDe(/<h2[\s>]/gi).filter((i) => i > 0)
  if (h2s.length > 0) {
    const melhor = h2s.reduce((a, b) => (Math.abs(b - meio) < Math.abs(a - meio) ? b : a))
    // Só usa se estiver razoavelmente no miolo (evita CTA logo no início/fim)
    if (melhor > html.length * 0.25 && melhor < html.length * 0.8) {
      return [html.slice(0, melhor), html.slice(melhor)]
    }
  }

  // 2) Fallback: fechamento de parágrafo mais próximo do meio
  const ps = indicesDe(/<\/p>/gi, 4).filter((i) => i > 4)
  if (ps.length > 0) {
    const melhor = ps.reduce((a, b) => (Math.abs(b - meio) < Math.abs(a - meio) ? b : a))
    if (melhor > html.length * 0.25 && melhor < html.length * 0.85) {
      return [html.slice(0, melhor), html.slice(melhor)]
    }
  }

  // 3) Não achou ponto seguro — não divide
  return [html, '']
}
