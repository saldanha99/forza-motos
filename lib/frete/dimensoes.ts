/**
 * Dimensões padrão por categoria — usadas como FALLBACK quando o
 * produto ainda não tem peso/dimensões cadastrados no banco.
 *
 * Valores estimados para produtos típicos de moto-peças.
 * Conforme os produtos forem sincronizados com dimensões reais do Olist,
 * o fallback fica obsoleto.
 *
 * Unidades:
 *   - peso: kg
 *   - altura/largura/comprimento: cm
 */

export interface Dimensoes {
  peso: number
  altura: number
  largura: number
  comprimento: number
}

/** Default genérico — usado quando categoria não está mapeada */
const DEFAULT_DIMENSOES: Dimensoes = {
  peso: 1.5,
  altura: 20,
  largura: 20,
  comprimento: 20,
}

const POR_CATEGORIA: Record<string, Dimensoes> = {
  // Pneus — costumam ter 600-700mm de diâmetro
  pneus: { peso: 7.5, altura: 70, largura: 70, comprimento: 20 },
  pneu: { peso: 7.5, altura: 70, largura: 70, comprimento: 20 },

  // Óleos — geralmente latas de 1L
  oleos: { peso: 1.0, altura: 25, largura: 10, comprimento: 10 },
  oleo: { peso: 1.0, altura: 25, largura: 10, comprimento: 10 },
  lubrificantes: { peso: 1.0, altura: 25, largura: 10, comprimento: 10 },

  // Pastilhas de freio — caixinhas pequenas
  pastilhas: { peso: 0.4, altura: 15, largura: 10, comprimento: 5 },
  pastilha: { peso: 0.4, altura: 15, largura: 10, comprimento: 5 },
  freios: { peso: 0.8, altura: 20, largura: 15, comprimento: 8 },

  // Correntes
  correntes: { peso: 1.8, altura: 20, largura: 15, comprimento: 15 },
  corrente: { peso: 1.8, altura: 20, largura: 15, comprimento: 15 },

  // Filtros
  filtros: { peso: 0.5, altura: 15, largura: 12, comprimento: 12 },
  filtro: { peso: 0.5, altura: 15, largura: 12, comprimento: 12 },

  // Capacetes
  capacetes: { peso: 1.8, altura: 30, largura: 30, comprimento: 35 },
  capacete: { peso: 1.8, altura: 30, largura: 30, comprimento: 35 },

  // Acessórios variados
  acessorios: { peso: 1.0, altura: 20, largura: 20, comprimento: 15 },
}

/**
 * Retorna as dimensões para uma categoria.
 * Tolera maiúsculas/minúsculas e plurais.
 */
export function dimensoesPorCategoria(categoria: string | null | undefined): Dimensoes {
  if (!categoria) return DEFAULT_DIMENSOES
  const key = categoria.toLowerCase().trim()
  return POR_CATEGORIA[key] || DEFAULT_DIMENSOES
}

/**
 * Mescla dimensões reais do produto (do banco) com fallback da categoria.
 * Campos nulos no produto recebem valor do fallback.
 */
export function resolverDimensoes(produto: {
  categoria: string
  peso?: number | null
  altura?: number | null
  largura?: number | null
  comprimento?: number | null
}): Dimensoes {
  const fallback = dimensoesPorCategoria(produto.categoria)
  return {
    peso: produto.peso ?? fallback.peso,
    altura: produto.altura ?? fallback.altura,
    largura: produto.largura ?? fallback.largura,
    comprimento: produto.comprimento ?? fallback.comprimento,
  }
}

/**
 * Soma dimensões de múltiplos produtos para cotar um carrinho.
 *
 * Estratégia simples:
 *   - Peso: soma direta (peso × quantidade)
 *   - Volume: pega o maior produto como base e adiciona altura
 *     dos outros (empilhamento aproximado)
 */
export function dimensoesDoCarrinho(
  items: Array<{
    quantidade: number
    produto: {
      categoria: string
      peso?: number | null
      altura?: number | null
      largura?: number | null
      comprimento?: number | null
    }
  }>
): Dimensoes {
  if (items.length === 0) return DEFAULT_DIMENSOES

  let pesoTotal = 0
  let alturaTotal = 0
  let larguraMax = 0
  let comprimentoMax = 0

  for (const item of items) {
    const d = resolverDimensoes(item.produto)
    pesoTotal += d.peso * item.quantidade
    alturaTotal += d.altura * item.quantidade
    larguraMax = Math.max(larguraMax, d.largura)
    comprimentoMax = Math.max(comprimentoMax, d.comprimento)
  }

  return {
    peso: Math.round(pesoTotal * 1000) / 1000,
    altura: Math.min(alturaTotal, 100), // cap em 100cm (limite Correios)
    largura: larguraMax,
    comprimento: comprimentoMax,
  }
}
