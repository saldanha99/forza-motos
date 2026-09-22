import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { getSettings } from '@/lib/settings'
import type { MeioPagamentoCheckout } from '@/lib/checkout/desconto-avista'

const TEMPO_LIMITE_MERCADO_PAGO_MS = 15_000

/**
 * Valida a assinatura HMAC do webhook do Mercado Pago.
 *
 * O MP envia o header `x-signature` no formato `ts=<timestamp>,v1=<hash>` e o
 * header `x-request-id`. O manifesto assinado é:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 * O hash é HMAC-SHA256(manifesto, MERCADOPAGO_WEBHOOK_SECRET) em hex.
 *
 * Configurar em: Mercado Pago → Suas integrações → Webhooks → "Assinatura secreta".
 *
 * FAIL-CLOSED: sem MERCADOPAGO_WEBHOOK_SECRET configurado nada é aceito. Um
 * webhook não autenticado confirma pedidos e movimenta estoque — deixar passar
 * "enquanto o segredo não é setado" é entregar essa capacidade a qualquer um.
 *
 * @returns true somente quando a assinatura confere.
 */
export function validarAssinaturaMP(input: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.error(
      '[mp] MERCADOPAGO_WEBHOOK_SECRET não configurado — TODOS os webhooks serão rejeitados.',
    )
    return false
  }

  if (!input.xSignature) return false

  // Extrai ts e v1 do header "ts=...,v1=..."
  let ts = ''
  let v1 = ''
  for (const parte of input.xSignature.split(',')) {
    const [chave, valor] = parte.split('=').map((s) => s?.trim())
    if (chave === 'ts') ts = valor ?? ''
    if (chave === 'v1') v1 = valor ?? ''
  }
  if (!ts || !v1) return false

  // Monta o manifesto exatamente como o MP espera (data.id em minúsculas)
  let manifesto = `id:${input.dataId.toLowerCase()};`
  if (input.xRequestId) manifesto += `request-id:${input.xRequestId};`
  manifesto += `ts:${ts};`

  const esperado = createHmac('sha256', secret).update(manifesto).digest('hex')

  // Comparação em tempo constante
  try {
    const a = Buffer.from(esperado, 'hex')
    const b = Buffer.from(v1, 'hex')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export interface ItemPagamento {
  id: string
  title: string
  quantity: number
  unit_price: number
  picture_url?: string
}

export interface PreferenciaPagamento {
  items: ItemPagamento[]
  /**
   * Quanto mais dados do comprador, melhor o score antifraude do MP e a
   * elegibilidade do Programa de Proteção ao Vendedor (chargeback de fraude).
   */
  payer?: {
    email: string
    name?: string
    surname?: string
    phone?: { area_code: string; number: string }
    identification?: { type: 'CPF' | 'CNPJ'; number: string }
    address?: { zip_code?: string; street_name?: string; street_number?: string }
  }
  external_reference: string
  back_urls: {
    success: string
    failure: string
    pending: string
  }
  /** Custo do frete cobrado junto do pedido (aparece como "Frete" no checkout do MP) */
  freteCusto?: number
  /** Chave estável da operação; evita preferências duplicadas em retries. */
  idempotencyKey?: string
  /** Expiração explícita, usada para alinhar a preferência à reserva local. */
  expirationDateTo?: Date | string
  /** Endpoint explícito para ambientes de teste/sandbox. Deve usar HTTPS. */
  notificationUrl?: string
  /**
   * Prioriza Pix e exclui cartões, boleto e outros tipos removíveis. O Checkout
   * Pro sempre mantém o saldo Mercado Pago, pois esse meio não pode ser
   * excluído pela API de preferências.
   */
  somentePix?: boolean
  /** Restringe o checkout da loja ao meio escolhido antes do redirecionamento. */
  meioPagamentoCheckout?: MeioPagamentoCheckout
}

export interface PreferenciaCriada {
  id: string
  init_point: string
  sandbox_init_point?: string | null
}

export class ErroPreferenciaPagamento extends Error {
  constructor(
    message: string,
    readonly resultadoIncerto: boolean,
  ) {
    super(message)
    this.name = 'ErroPreferenciaPagamento'
  }
}

export const MAX_PARCELAS_CREDITO = 12

export function normalizarMaxParcelasCredito(valor: unknown): number {
  const numero = typeof valor === 'string' ? Number.parseInt(valor, 10) : Number(valor)
  if (!Number.isFinite(numero) || numero < 1) return MAX_PARCELAS_CREDITO
  return Math.min(Math.trunc(numero), MAX_PARCELAS_CREDITO)
}

export function tiposPagamentoExcluidos(config: {
  acceptCards: boolean
  acceptTicket: boolean
  acceptPix: boolean
}): Array<{ id: string }> {
  const tipos: Array<{ id: string }> = []
  if (!config.acceptCards) {
    tipos.push({ id: 'credit_card' }, { id: 'debit_card' })
  }
  if (!config.acceptTicket) tipos.push({ id: 'ticket' })
  if (!config.acceptPix) tipos.push({ id: 'bank_transfer' })
  return tipos
}

/**
 * Na compra avulsa da caneca o contrato comercial é Pix ou saldo Mercado Pago.
 * A API do Checkout Pro não permite excluir `account_money`; `bank_transfer`
 * também não entra porque é o tipo do Pix no Brasil.
 */
export function tiposPagamentoExcluidosParaPix(): Array<{ id: string }> {
  return [
    { id: 'credit_card' },
    { id: 'debit_card' },
    { id: 'prepaid_card' },
    { id: 'ticket' },
    { id: 'digital_currency' },
    { id: 'atm' },
  ]
}

export function pagamentoCanecaPirelliPermitido(paymentMethodId: unknown) {
  return paymentMethodId === 'pix' || paymentMethodId === 'account_money'
}

/**
 * A loja opera somente com Pix. Cartão, boleto, linha de crédito e demais
 * modalidades removíveis são excluídos da preferência. `account_money` não é
 * listado porque o Checkout Pro não permite ocultar o saldo Mercado Pago.
 */
export function tiposPagamentoExcluidosParaCheckout(
  _meio: MeioPagamentoCheckout,
): Array<{ id: string }> {
  return [
    { id: 'credit_card' },
    { id: 'debit_card' },
    { id: 'prepaid_card' },
    { id: 'ticket' },
    { id: 'digital_currency' },
    { id: 'atm' },
  ]
}

/** Gera um UUID estável e não reversível para a chave de idempotência do MP. */
export function chaveIdempotenciaMP(referencia: string): string {
  const hash = createHash('sha256').update(referencia).digest('hex')
  const variante = ['8', '9', 'a', 'b'][Number.parseInt(hash[16]!, 16) % 4]
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variante}${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function preferenciaCriadaDaResposta(data: any): PreferenciaCriada {
  if (!data?.id || !data?.init_point) throw new Error('Preferência incompleta')
  const sandboxInitPoint = data.sandbox_init_point ? String(data.sandbox_init_point) : null
  const initPoint = process.env.MERCADOPAGO_SANDBOX === 'true' && sandboxInitPoint
    ? sandboxInitPoint
    : String(data.init_point)
  return {
    id: String(data.id),
    init_point: initPoint,
    sandbox_init_point: sandboxInitPoint,
  }
}

export async function obterPreferencia(
  id: string,
  tokenFornecido?: string,
): Promise<PreferenciaCriada> {
  const token = tokenFornecido ?? process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
  const res = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MERCADO_PAGO_MS),
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Falha ao consultar preferência (${res.status})`)
  const data = await res.json()
  return preferenciaCriadaDaResposta(data)
}

/**
 * Reconcilia pelo identificador local enviado como external_reference. Essa
 * busca é a fonte segura para retomar um POST cujo resultado foi ambíguo.
 */
export async function reconciliarPreferencia(externalReference: string): Promise<PreferenciaCriada | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')
  const query = new URLSearchParams({ external_reference: externalReference, limit: '10' })
  const res = await fetch(`https://api.mercadopago.com/checkout/preferences/search?${query}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(TEMPO_LIMITE_MERCADO_PAGO_MS),
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Falha ao reconciliar preferência (${res.status})`)
  const data = await res.json()
  const encontrada = Array.isArray(data?.elements)
    ? data.elements.find((item: any) => item?.external_reference === externalReference)
    : null
  if (!encontrada?.id) return null
  return obterPreferencia(String(encontrada.id), token)
}

/** Monta o payer completo a partir dos dados do checkout (todos opcionais, defensivo) */
export function montarPayer(dados: {
  email?: string | null
  nome?: string | null
  telefone?: string | null
  cpf?: string | null
  cep?: string | null
  rua?: string | null
  numero?: string | null
}): PreferenciaPagamento['payer'] | undefined {
  if (!dados.email) return undefined

  const partesNome = (dados.nome ?? '').trim().split(/\s+/)
  const name = partesNome[0] || undefined
  const surname = partesNome.length > 1 ? partesNome.slice(1).join(' ') : undefined

  const foneBruto = (dados.telefone ?? '').replace(/\D/g, '')
  // O cadastro Pirelli guarda E.164 (55 + DDD + número), enquanto os checkouts
  // comuns usam o formato nacional. O Mercado Pago espera DDD separado e não
  // aceita que o código do país seja enviado como area_code.
  const fone = foneBruto.startsWith('55') && (foneBruto.length === 12 || foneBruto.length === 13)
    ? foneBruto.slice(2)
    : foneBruto
  const phone =
    fone.length === 10 || fone.length === 11
      ? { area_code: fone.slice(0, 2), number: fone.slice(2) }
      : undefined

  const doc = (dados.cpf ?? '').replace(/\D/g, '')
  const identification =
    doc.length === 11
      ? ({ type: 'CPF', number: doc } as const)
      : doc.length === 14
        ? ({ type: 'CNPJ', number: doc } as const)
        : undefined

  const cep = (dados.cep ?? '').replace(/\D/g, '')
  const address =
    cep.length === 8
      ? { zip_code: cep, street_name: dados.rua ?? undefined, street_number: dados.numero ?? undefined }
      : undefined

  return { email: dados.email, name, surname, phone, identification, address }
}

export async function criarPreferencia(dados: PreferenciaPagamento): Promise<PreferenciaCriada> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new ErroPreferenciaPagamento('MERCADOPAGO_ACCESS_TOKEN não configurado', false)

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const notificationUrlConfigurada = dados.notificationUrl ?? process.env.MERCADOPAGO_NOTIFICATION_URL
  let notificationUrl = `${baseUrl}/api/mercadopago/webhook`
  if (notificationUrlConfigurada) {
    try {
      const url = new URL(notificationUrlConfigurada)
      if (url.protocol !== 'https:') throw new Error('protocolo inseguro')
      notificationUrl = url.toString()
    } catch {
      throw new ErroPreferenciaPagamento('MERCADOPAGO_NOTIFICATION_URL deve ser uma URL HTTPS válida.', false)
    }
  }

  // Carrega configurações do painel admin
  const keys = [
    'mp_checkout_pro_enabled',
    'mp_accept_cards',
    'mp_accept_ticket',
    'mp_accept_pix',
    'mp_max_installments',
    'mp_auto_return',
    'mp_binary_mode',
    'mp_preference_expiration_minutes'
  ]
  let settings: Awaited<ReturnType<typeof getSettings>>
  try {
    settings = await getSettings(keys)
  } catch (error) {
    throw new ErroPreferenciaPagamento(`Configuração do Mercado Pago indisponível: ${String(error)}`, false)
  }

  // 1. Verifica se o Checkout do Mercado Pago está ativado
  if (settings['mp_checkout_pro_enabled'] === 'false') {
    throw new ErroPreferenciaPagamento('O checkout via Mercado Pago está temporariamente desativado.', false)
  }

  // 2. Monta meios de pagamento
  if (dados.somentePix && dados.meioPagamentoCheckout) {
    throw new ErroPreferenciaPagamento('Configuração de pagamento conflitante.', false)
  }
  const acceptCards = dados.somentePix ? false : settings['mp_accept_cards'] !== 'false' // default true
  const acceptTicket = dados.somentePix ? false : settings['mp_accept_ticket'] !== 'false' // default true
  const acceptPix = settings['mp_accept_pix'] !== 'false' // default true
  if (dados.somentePix && !acceptPix) {
    throw new ErroPreferenciaPagamento('O pagamento Pix está temporariamente desativado.', false)
  }

  if (dados.meioPagamentoCheckout === 'PIX' && !acceptPix) {
    throw new ErroPreferenciaPagamento('O pagamento Pix está temporariamente desativado.', false)
  }
  const excluded_payment_types = dados.somentePix
    ? tiposPagamentoExcluidosParaPix()
    : dados.meioPagamentoCheckout
      ? tiposPagamentoExcluidosParaCheckout(dados.meioPagamentoCheckout)
      : tiposPagamentoExcluidos({ acceptCards, acceptTicket, acceptPix })

  const payment_methods: any = {}
  if (excluded_payment_types.length > 0) {
    payment_methods.excluded_payment_types = excluded_payment_types
  }
  if (dados.somentePix || dados.meioPagamentoCheckout === 'PIX') {
    payment_methods.default_payment_method_id = 'pix'
  }

  // 3. Máximo de parcelas
  const maxInstallments = normalizarMaxParcelasCredito(settings['mp_max_installments'])
  if (!dados.somentePix && !dados.meioPagamentoCheckout) {
    payment_methods.installments = maxInstallments
  }

  // 5. Retorno automático
  const autoReturn = settings['mp_auto_return'] || 'approved'

  // 6. Modo binário
  const binaryMode = settings['mp_binary_mode'] === 'true'

  // 7. Expiração da preferência
  const expirationMinutes = settings['mp_preference_expiration_minutes']
    ? parseInt(settings['mp_preference_expiration_minutes'], 10)
    : undefined

  const body: any = {
    items: dados.items,
    payer: dados.payer,
    external_reference: dados.external_reference,
    back_urls: {
      success: dados.back_urls.success || `${baseUrl}/checkout/sucesso`,
      failure: dados.back_urls.failure || `${baseUrl}/checkout/erro`,
      pending: dados.back_urls.pending || `${baseUrl}/checkout/pendente`,
    },
    auto_return: autoReturn === 'off' ? undefined : autoReturn,
    binary_mode: binaryMode,
    notification_url: notificationUrl,
    statement_descriptor: 'FORZA MOTOS',
  }

  // Frete cobrado junto do pedido — MP soma ao total e mostra como "Frete"
  if (dados.freteCusto && dados.freteCusto > 0) {
    body.shipments = { mode: 'not_specified', cost: Number(dados.freteCusto.toFixed(2)) }
  }

  if (Object.keys(payment_methods).length > 0) {
    body.payment_methods = payment_methods
  }

  const dateFrom = new Date()
  const explicitExpiration = dados.expirationDateTo
    ? new Date(dados.expirationDateTo)
    : null
  if (explicitExpiration && (!Number.isFinite(explicitExpiration.getTime()) || explicitExpiration <= dateFrom)) {
    throw new ErroPreferenciaPagamento('Data de expiração da preferência inválida.', false)
  }
  if (explicitExpiration || (expirationMinutes && expirationMinutes > 0)) {
    const dateTo = explicitExpiration ?? new Date(dateFrom.getTime() + expirationMinutes! * 60 * 1000)
    body.expires = true
    body.expiration_date_from = dateFrom.toISOString()
    body.expiration_date_to = dateTo.toISOString()
  }

  // Retry do mesmo external_reference: reutiliza a preferência já criada.
  const existente = await reconciliarPreferencia(dados.external_reference).catch(() => null)
  if (existente) return existente

  let res: Response
  try {
    res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      signal: AbortSignal.timeout(TEMPO_LIMITE_MERCADO_PAGO_MS),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(dados.idempotencyKey ? { 'X-Idempotency-Key': dados.idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    const reconciliada = await reconciliarPreferencia(dados.external_reference).catch(() => null)
    if (reconciliada) return reconciliada
    throw new ErroPreferenciaPagamento(`Resultado incerto ao criar preferência: ${String(error)}`, true)
  }

  if (!res.ok) {
    const erro = await res.text().catch(() => '')
    // Timeout HTTP e erros do servidor podem ocorrer depois do commit remoto.
    if (res.status === 408 || res.status === 409 || res.status === 429 || res.status >= 500) {
      const reconciliada = await reconciliarPreferencia(dados.external_reference).catch(() => null)
      if (reconciliada) return reconciliada
      throw new ErroPreferenciaPagamento(`Resultado incerto do Mercado Pago (${res.status})`, true)
    }
    throw new ErroPreferenciaPagamento(`Erro Mercado Pago (${res.status}): ${erro.slice(0, 300)}`, false)
  }

  try {
    const data = await res.json()
    return preferenciaCriadaDaResposta(data)
  } catch (error) {
    const reconciliada = await reconciliarPreferencia(dados.external_reference).catch(() => null)
    if (reconciliada) return reconciliada
    throw new ErroPreferenciaPagamento(`Resultado incerto ao interpretar preferência: ${String(error)}`, true)
  }
}
