export const DESCONTO_AVISTA_PERCENTUAL = 5

export const MEIOS_PAGAMENTO_CHECKOUT = ['PIX'] as const

export type MeioPagamentoCheckout = (typeof MEIOS_PAGAMENTO_CHECKOUT)[number]

export function normalizarMeioPagamentoCheckout(valor: unknown): MeioPagamentoCheckout {
  const normalizado = String(valor ?? '').trim().toUpperCase()
  if (!MEIOS_PAGAMENTO_CHECKOUT.includes(normalizado as MeioPagamentoCheckout)) {
    throw new Error('FORMA_PAGAMENTO_INVALIDA')
  }
  return normalizado as MeioPagamentoCheckout
}

export function meioPagamentoTemDesconto(meio: MeioPagamentoCheckout): boolean {
  return meio === 'PIX'
}

/**
 * Calcula o desconto somente sobre os produtos, depois de eventual cupom.
 * O frete fica fora da base e todos os valores são fechados em centavos.
 */
export function calcularDescontoAvista(
  subtotalProdutos: number,
  descontoCupom: number,
  meio: MeioPagamentoCheckout,
): number {
  if (!meioPagamentoTemDesconto(meio)) return 0

  const subtotalCentavos = Math.max(0, Math.round(Number(subtotalProdutos) * 100))
  const cupomCentavos = Math.max(0, Math.round(Number(descontoCupom) * 100))
  const baseCentavos = Math.max(0, subtotalCentavos - cupomCentavos)

  return Math.round(baseCentavos * (DESCONTO_AVISTA_PERCENTUAL / 100)) / 100
}

/** Confere a modalidade aprovada usando o tipo financeiro oficial do MP. */
export function pagamentoCompativelComCheckout(
  meio: unknown,
  paymentMethodId: string | null,
  paymentTypeId: string | null,
): boolean {
  const contrato = String(meio ?? '').toUpperCase()
  const metodo = String(paymentMethodId ?? '').toLowerCase()
  const tipo = String(paymentTypeId ?? '').toLowerCase()

  // O Checkout Pro não permite ocultar o saldo Mercado Pago. Como ele também
  // liquida à vista e não cria custo de crédito/parcelamento, permanece aceito
  // pela integração, embora a loja ofereça e comunique Pix como modalidade.
  if (tipo === 'account_money') return true
  if (contrato === 'PIX') return metodo === 'pix' && tipo === 'bank_transfer'

  // Compatibilidade financeira para preferências abertas antes da mudança
  // Pix-only. Pedidos novos nunca persistem estes contratos, mas um pagamento
  // antigo ainda precisa ser confirmado segundo a modalidade já contratada.
  if (contrato === 'BOLETO') return tipo === 'ticket'
  if (contrato === 'CARTAO') {
    return tipo === 'credit_card' || tipo === 'debit_card' || tipo === 'prepaid_card'
  }
  return false
}
