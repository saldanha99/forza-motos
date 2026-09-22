export interface PagamentoMPNormalizado {
  id: string
  status: string
  status_detail: string | null
  external_reference: string | null
  transaction_amount: number | null
  /**
   * O Checkout Pro separa o frete do valor dos itens no GET do pagamento.
   * Ex.: produto R$ 0,95 + frete R$ 11,93 chegam como
   * transaction_amount=0.95 e shipping_amount=11.93.
   */
  shipping_amount?: number | null
  /** Total cobrado do comprador, incluindo o frete destacado pelo Checkout Pro. */
  total_paid_amount?: number | null
  currency_id: string | null
  preference_id: string | null
  collector_id: string | null
  payment_method_id: string | null
  payment_type_id: string | null
  order_id: string | null
}

export interface PreferenciaMPNormalizada {
  id: string
  external_reference: string | null
  collector_id: string | null
  total: number | null
  currency_id: string | null
}

export class ErroConsultaPagamentoMP extends Error {
  constructor(message: string, readonly httpStatus?: number) {
    super(message)
    this.name = 'ErroConsultaPagamentoMP'
  }
}

export class ErroValidacaoPagamentoMP extends Error {
  constructor(readonly codigo: string) {
    super(codigo)
    this.name = 'ErroValidacaoPagamentoMP'
  }
}

function tokenMP(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new ErroConsultaPagamentoMP('MERCADOPAGO_ACCESS_TOKEN não configurado')
  return token
}

async function fetchJsonMP(url: string): Promise<{ status: number; ok: boolean; data: any }> {
  let resposta: Response
  try {
    resposta = await fetch(url, { headers: { Authorization: `Bearer ${tokenMP()}` } })
  } catch (error) {
    throw new ErroConsultaPagamentoMP(`Falha de rede ao consultar Mercado Pago: ${String(error)}`)
  }
  if (resposta.status === 404) return { status: 404, ok: false, data: null }
  if (!resposta.ok) {
    throw new ErroConsultaPagamentoMP(`Mercado Pago retornou HTTP ${resposta.status}`, resposta.status)
  }
  try {
    return { status: resposta.status, ok: true, data: await resposta.json() }
  } catch (error) {
    throw new ErroConsultaPagamentoMP(`Resposta ilegível do Mercado Pago: ${String(error)}`, resposta.status)
  }
}

function textoOuNull(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  return String(valor)
}

async function resolverPreferenceId(payment: any): Promise<string | null> {
  const direto =
    payment?.preference_id ??
    payment?.metadata?.preference_id ??
    payment?.additional_info?.preference_id
  if (direto) return String(direto)

  const merchantOrderId = payment?.order?.id
  if (!merchantOrderId) return null
  let resultado: Awaited<ReturnType<typeof fetchJsonMP>>
  try {
    resultado = await fetchJsonMP(
      `https://api.mercadopago.com/merchant_orders/${encodeURIComponent(String(merchantOrderId))}`,
    )
  } catch (error) {
    // No Checkout Pro de teste, o GET do pagamento pode ser autorizado pelo
    // token enquanto a merchant order devolve 403. A ausência será validada
    // mais adiante contra a preferência persistida; outras falhas continuam
    // retentáveis para não esconder indisponibilidade do Mercado Pago.
    if (error instanceof ErroConsultaPagamentoMP && error.httpStatus === 403) return null
    throw error
  }
  if (!resultado.ok) return null
  return textoOuNull(resultado.data?.preference_id)
}

export async function normalizarPagamentoMP(
  payment: any,
  opts: { resolverPreferencia?: boolean } = {},
): Promise<PagamentoMPNormalizado> {
  const id = textoOuNull(payment?.id)
  const status = textoOuNull(payment?.status)
  if (!id || !status) throw new ErroConsultaPagamentoMP('Pagamento sem id/status')

  const valor = Number(payment?.transaction_amount)
  const frete = Number(payment?.shipping_amount)
  const totalPago = Number(payment?.transaction_details?.total_paid_amount)
  return {
    id,
    status,
    status_detail: textoOuNull(payment?.status_detail),
    external_reference: textoOuNull(payment?.external_reference),
    transaction_amount: Number.isFinite(valor) ? valor : null,
    shipping_amount: Number.isFinite(frete) ? frete : null,
    total_paid_amount: Number.isFinite(totalPago) ? totalPago : null,
    currency_id: textoOuNull(payment?.currency_id),
    preference_id: opts.resolverPreferencia === false
      ? textoOuNull(payment?.preference_id)
      : await resolverPreferenceId(payment),
    collector_id: textoOuNull(payment?.collector_id),
    payment_method_id: textoOuNull(payment?.payment_method_id),
    payment_type_id: textoOuNull(payment?.payment_type_id),
    order_id: textoOuNull(payment?.order?.id),
  }
}

/** Retorna null somente para um 404 conclusivo; demais falhas devem ser retentadas. */
export async function consultarPagamentoMP(paymentId: string): Promise<PagamentoMPNormalizado | null> {
  const resultado = await fetchJsonMP(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`,
  )
  if (!resultado.ok) return null
  return normalizarPagamentoMP(resultado.data)
}

function normalizarTotalPreferencia(data: any): { total: number | null; currencyId: string | null } {
  if (!Array.isArray(data?.items) || data.items.length === 0) {
    return { total: null, currencyId: null }
  }

  let totalCentavos = 0
  let moeda: string | null = null
  for (const item of data.items) {
    const quantidade = Number(item?.quantity)
    const precoUnitario = Number(item?.unit_price)
    const moedaItem = textoOuNull(item?.currency_id)
    if (
      !Number.isInteger(quantidade) ||
      quantidade <= 0 ||
      !Number.isFinite(precoUnitario) ||
      precoUnitario < 0 ||
      !moedaItem ||
      (moeda !== null && moeda !== moedaItem)
    ) {
      return { total: null, currencyId: null }
    }
    moeda = moedaItem
    totalCentavos += centavos(precoUnitario) * quantidade
  }

  const custoFreteBruto = data?.shipments?.cost
  if (custoFreteBruto !== null && custoFreteBruto !== undefined && custoFreteBruto !== '') {
    const custoFrete = Number(custoFreteBruto)
    if (!Number.isFinite(custoFrete) || custoFrete < 0) {
      return { total: null, currencyId: null }
    }
    totalCentavos += centavos(custoFrete)
  }

  return { total: totalCentavos / 100, currencyId: moeda }
}

/** Consulta a preferência persistida para correlacionar pagamentos que a omitem. */
export async function consultarPreferenciaMP(
  preferenceId: string,
): Promise<PreferenciaMPNormalizada | null> {
  const resultado = await fetchJsonMP(
    `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(preferenceId)}`,
  )
  if (!resultado.ok) return null

  const id = textoOuNull(resultado.data?.id)
  if (!id) throw new ErroConsultaPagamentoMP('Preferência sem id', resultado.status)
  const { total, currencyId } = normalizarTotalPreferencia(resultado.data)
  return {
    id,
    external_reference: textoOuNull(resultado.data?.external_reference),
    collector_id: textoOuNull(resultado.data?.collector_id),
    total,
    currency_id: currencyId,
  }
}

export async function obterCollectorIdEsperado(): Promise<string> {
  const configurado = process.env.MERCADOPAGO_COLLECTOR_ID
  if (!configurado) {
    throw new ErroConsultaPagamentoMP(
      'MERCADOPAGO_COLLECTOR_ID obrigatório para validar o recebedor do webhook',
    )
  }
  return String(configurado)
}

export async function validarRecebedorPagamentoMP(payment: PagamentoMPNormalizado): Promise<void> {
  if (!payment.collector_id) throw new ErroValidacaoPagamentoMP('COLLECTOR_AUSENTE')
  const esperado = await obterCollectorIdEsperado()
  if (payment.collector_id !== esperado) throw new ErroValidacaoPagamentoMP('COLLECTOR_DIVERGENTE')
}

function centavos(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100)
}

/** Valor integral cobrado pelo Checkout Pro, com o frete destacado incluído. */
export function valorTotalPagamentoMP(payment: PagamentoMPNormalizado): number | null {
  if (payment.transaction_amount === null) return null
  const freteCentavos = payment.shipping_amount === null || payment.shipping_amount === undefined
    ? 0
    : centavos(payment.shipping_amount)
  const totalCompostoCentavos = centavos(payment.transaction_amount) + freteCentavos
  const totalPagoCentavos = payment.total_paid_amount === null || payment.total_paid_amount === undefined
    ? totalCompostoCentavos
    : centavos(payment.total_paid_amount)
  if (
    freteCentavos < 0 ||
    totalCompostoCentavos < 0 ||
    totalPagoCentavos < 0 ||
    totalPagoCentavos !== totalCompostoCentavos
  ) return null
  return totalPagoCentavos / 100
}

/** Valida os vínculos financeiros antes de qualquer transição do pedido. */
export async function validarPagamentoDoPedido(input: {
  orderId: string
  total: number
  preferenceId: string | null
  payment: PagamentoMPNormalizado
}, deps: {
  consultarPreferencia?: typeof consultarPreferenciaMP
} = {}): Promise<{ preferenceId: string }> {
  const { payment } = input
  if (payment.external_reference !== input.orderId) {
    throw new ErroValidacaoPagamentoMP('EXTERNAL_REFERENCE_DIVERGENTE')
  }
  if (payment.currency_id !== 'BRL') throw new ErroValidacaoPagamentoMP('MOEDA_DIVERGENTE')
  const totalPago = valorTotalPagamentoMP(payment)
  if (totalPago === null || centavos(totalPago) !== centavos(input.total)) {
    throw new ErroValidacaoPagamentoMP('VALOR_DIVERGENTE')
  }
  await validarRecebedorPagamentoMP(payment)

  if (payment.preference_id) {
    if (input.preferenceId && payment.preference_id !== input.preferenceId) {
      throw new ErroValidacaoPagamentoMP('PREFERENCIA_DIVERGENTE')
    }
    return { preferenceId: payment.preference_id }
  }

  // Alguns pagamentos de Checkout Pro (observado em boleto no sandbox) não
  // expõem preference_id, e o endpoint da merchant order pode negar acesso.
  // O fallback só existe quando já há uma preferência durável no pedido e o
  // pagamento declara uma merchant order. Isso impede aceitar um pagamento
  // avulso apenas por coincidir referência e valor.
  if (!input.preferenceId) throw new ErroValidacaoPagamentoMP('PREFERENCIA_AUSENTE')
  if (!payment.order_id) throw new ErroValidacaoPagamentoMP('MERCHANT_ORDER_AUSENTE')

  const preferencia = await (deps.consultarPreferencia ?? consultarPreferenciaMP)(input.preferenceId)
  if (!preferencia) throw new ErroValidacaoPagamentoMP('PREFERENCIA_NAO_LOCALIZADA')
  if (preferencia.id !== input.preferenceId) {
    throw new ErroValidacaoPagamentoMP('PREFERENCIA_DIVERGENTE')
  }
  if (preferencia.external_reference !== input.orderId) {
    throw new ErroValidacaoPagamentoMP('PREFERENCIA_REFERENCIA_DIVERGENTE')
  }
  if (
    !preferencia.collector_id ||
    preferencia.collector_id !== payment.collector_id ||
    preferencia.collector_id !== await obterCollectorIdEsperado()
  ) {
    throw new ErroValidacaoPagamentoMP('PREFERENCIA_COLLECTOR_DIVERGENTE')
  }
  if (preferencia.currency_id !== 'BRL') {
    throw new ErroValidacaoPagamentoMP('PREFERENCIA_MOEDA_DIVERGENTE')
  }
  if (preferencia.total === null || centavos(preferencia.total) !== centavos(input.total)) {
    throw new ErroValidacaoPagamentoMP('PREFERENCIA_VALOR_DIVERGENTE')
  }
  return { preferenceId: input.preferenceId }
}
