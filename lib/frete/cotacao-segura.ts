export interface ItemCotacaoSeguro {
  productId: string
  quantidade: number
}

export interface ProdutoPrecoCotacao {
  id: string
  preco: number
  precoPromocional?: number | null
}

/** Aceita só identidade/quantidade e descarta preço, subtotal e frete do cliente. */
export function normalizarItensCotacao(itemsRaw: unknown): ItemCotacaoSeguro[] {
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0 || itemsRaw.length > 50) {
    throw new Error('Carrinho inválido')
  }

  const quantidades = new Map<string, number>()
  for (const itemRaw of itemsRaw) {
    const item = itemRaw as Record<string, unknown>
    const productId = String(item?.productId ?? '').trim()
    const quantidade = Number(item?.quantidade)
    if (!productId || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 100) {
      throw new Error('Produto ou quantidade inválidos')
    }
    const total = (quantidades.get(productId) ?? 0) + quantidade
    if (total > 100) throw new Error('Quantidade máxima excedida')
    quantidades.set(productId, total)
  }

  return Array.from(quantidades.entries()).map(([productId, quantidade]) => ({
    productId,
    quantidade,
  }))
}

/** Calcula somente com snapshots vindos do banco, nunca com campos do payload. */
export function calcularSubtotalServidor(
  items: ItemCotacaoSeguro[],
  produtos: ProdutoPrecoCotacao[],
): number {
  const porId = new Map(produtos.map((produto) => [produto.id, produto]))
  return items.reduce((total, item) => {
    const produto = porId.get(item.productId)
    if (!produto) throw new Error('Produto não encontrado')
    const preco = Number(produto.precoPromocional ?? produto.preco)
    if (!Number.isFinite(preco) || preco < 0) throw new Error('Preço de produto inválido')
    return total + preco * item.quantidade
  }, 0)
}
