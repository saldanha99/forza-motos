import { createHmac, timingSafeEqual } from 'crypto'
import { getSettings } from '@/lib/settings'

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
 * @returns true se válido OU se o segredo não estiver configurado (modo gracioso).
 */
export function validarAssinaturaMP(input: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) {
    console.warn(
      '[mp] MERCADOPAGO_WEBHOOK_SECRET não configurado — assinatura do webhook NÃO validada.',
    )
    return true
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

  const fone = (dados.telefone ?? '').replace(/\D/g, '')
  const phone =
    fone.length >= 10
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

export async function criarPreferencia(dados: PreferenciaPagamento) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

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
  const settings = await getSettings(keys)

  // 1. Verifica se o Checkout do Mercado Pago está ativado
  if (settings['mp_checkout_pro_enabled'] === 'false') {
    throw new Error('O checkout via Mercado Pago está temporariamente desativado.')
  }

  // 2. Monta meios de pagamento
  const acceptCards = settings['mp_accept_cards'] !== 'false' // default true
  const acceptTicket = settings['mp_accept_ticket'] !== 'false' // default true
  const acceptPix = settings['mp_accept_pix'] !== 'false' // default true
  
  const excluded_payment_types: { id: string }[] = []
  if (!acceptCards) {
    excluded_payment_types.push({ id: 'credit_card' })
    excluded_payment_types.push({ id: 'debit_card' })
  }
  if (!acceptTicket) {
    excluded_payment_types.push({ id: 'ticket' })
    excluded_payment_types.push({ id: 'account_money' })
  }
  if (!acceptPix) {
    excluded_payment_types.push({ id: 'bank_transfer' })
  }

  const payment_methods: any = {}
  if (excluded_payment_types.length > 0) {
    payment_methods.excluded_payment_types = excluded_payment_types
  }

  // 3. Máximo de parcelas
  const maxInstallments = settings['mp_max_installments']
    ? parseInt(settings['mp_max_installments'], 10)
    : undefined
  if (maxInstallments) {
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
    notification_url: `${baseUrl}/api/mercadopago/webhook`,
    statement_descriptor: 'FORZA MOTOS',
  }

  if (Object.keys(payment_methods).length > 0) {
    body.payment_methods = payment_methods
  }

  if (expirationMinutes && expirationMinutes > 0) {
    const dateFrom = new Date()
    const dateTo = new Date(dateFrom.getTime() + expirationMinutes * 60 * 1000)
    body.expires = true
    body.expiration_date_from = dateFrom.toISOString()
    body.expiration_date_to = dateTo.toISOString()
  }

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Erro Mercado Pago: ${erro}`)
  }

  const data = await res.json()
  return { id: data.id, init_point: data.init_point, sandbox_init_point: data.sandbox_init_point }
}
