export interface ItemWebhookEstoque {
  productId: string
  quantidade: number
  estoqueReservado: boolean
  preVendaSnapshot: boolean
}

/**
 * A decisão usa o snapshot da compra. Alterar o cadastro do produto depois do
 * checkout não pode transformar uma pré-venda já paga em venda de estoque.
 */
export function itensParaVerificarNoTiny(itens: ItemWebhookEstoque[]) {
  return itens
    .filter((item) => item.estoqueReservado && !item.preVendaSnapshot)
    .map((item) => ({ productId: item.productId, quantidade: item.quantidade }))
}
