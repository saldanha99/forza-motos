import { createHmac, timingSafeEqual } from 'crypto'

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
  payer?: { email: string; name?: string }
  external_reference: string
  back_urls: {
    success: string
    failure: string
    pending: string
  }
}

export async function criarPreferencia(dados: PreferenciaPagamento) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado')

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

  const body = {
    items: dados.items,
    payer: dados.payer,
    external_reference: dados.external_reference,
    back_urls: {
      success: `${baseUrl}/checkout/sucesso`,
      failure: `${baseUrl}/checkout/erro`,
      pending: `${baseUrl}/checkout/pendente`,
    },
    auto_return: 'approved',
    notification_url: `${baseUrl}/api/mercadopago/webhook`,
    statement_descriptor: 'FORZA MOTOS',
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
