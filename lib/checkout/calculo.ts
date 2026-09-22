export interface ItemCarrinhoEntrada {
  productId: unknown
  quantidade: unknown
  /** Campos adicionais do cliente são deliberadamente ignorados. */
  [campo: string]: unknown
}

export interface ProdutoParaCheckout {
  id: string
  nome: string
  preco: unknown
  precoPromocional: unknown
  estoque: number
  preVenda: boolean
  prazoEntregaDias?: number | null
  eventoPirelliId?: string | null
  limitePorPedidoEvento?: number | null
}

export function normalizarItensCarrinho(items: unknown): Array<{ productId: string; quantidade: number }> {
  if (!Array.isArray(items) || items.length === 0) throw new Error('CARRINHO_VAZIO')
  if (items.length > 100) throw new Error('QUANTIDADE_INVALIDA')

  const agrupados = new Map<string, number>()
  for (const entrada of items as ItemCarrinhoEntrada[]) {
    const productId = String(entrada?.productId ?? '')
    const quantidade = Number(entrada?.quantidade)
    if (
      !productId || productId.length > 100 ||
      !Number.isInteger(quantidade) || quantidade <= 0 || quantidade > 100
    ) throw new Error('QUANTIDADE_INVALIDA')
    const total = (agrupados.get(productId) ?? 0) + quantidade
    if (total > 100) throw new Error('QUANTIDADE_INVALIDA')
    agrupados.set(productId, total)
  }
  return Array.from(agrupados, ([productId, quantidade]) => ({ productId, quantidade }))
}

export function precificarItensNoServidor<T extends ProdutoParaCheckout>(
  entradas: Array<{ productId: string; quantidade: number }>,
  produtos: T[],
) {
  if (produtos.length !== entradas.length) throw new Error('PRODUTO_INVALIDO')
  const items = entradas.map((entrada) => {
    const produto = produtos.find((item) => item.id === entrada.productId)
    if (!produto) throw new Error('PRODUTO_INVALIDO')
    const precoUnitario = Number(produto.precoPromocional ?? produto.preco)
    if (!Number.isFinite(precoUnitario) || precoUnitario <= 0) throw new Error('PRODUTO_INVALIDO')
    return { ...entrada, precoUnitario, produto }
  })
  const subtotal = Number(
    items.reduce((total, item) => total + item.precoUnitario * item.quantidade, 0).toFixed(2),
  )
  if (!Number.isFinite(subtotal) || subtotal <= 0) throw new Error('PRODUTO_INVALIDO')
  return { items, subtotal }
}

export function selecionarFreteDoServidor<T extends { id: string; preco: number; prazo: number }>(
  opcoes: T[],
  idSolicitado: unknown,
): T {
  const frete = opcoes.find((opcao) => opcao.id === idSolicitado)
  if (
    !frete ||
    !Number.isFinite(frete.preco) || frete.preco < 0 ||
    !Number.isInteger(frete.prazo) || frete.prazo < 0
  ) throw new Error('FRETE_INVALIDO')
  return frete
}
