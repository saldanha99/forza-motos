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
