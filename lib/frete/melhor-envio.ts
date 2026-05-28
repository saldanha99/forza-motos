/**
 * Cliente do Melhor Envio (https://melhorenvio.com.br/api/v2)
 *
 * Setup (uma vez):
 *   1. Criar conta gratuita em https://melhorenvio.com.br
 *   2. Menu → Configurações → Tokens → Gerar Token de API
 *   3. Colar em MELHOR_ENVIO_TOKEN no .env
 *   4. Definir MELHOR_ENVIO_CEP_ORIGEM (CEP do galpão/loja)
 *
 * Em desenvolvimento, use o sandbox (recomendado):
 *   MELHOR_ENVIO_URL=https://sandbox.melhorenvio.com.br/api/v2
 *
 * Em produção:
 *   MELHOR_ENVIO_URL=https://www.melhorenvio.com.br/api/v2
 *
 * Custo: free pra cotar. Só paga quando compra etiqueta (com desconto
 * de 10-50% vs balcão dos Correios).
 */

import type { Dimensoes } from './dimensoes'

export interface CotacaoInput {
  cepDestino: string
  /** Dimensões agregadas do carrinho */
  dimensoes: Dimensoes
  /** Valor total do pedido (para seguro). Em reais. */
  valorTotal: number
  /** Filtra apenas alguns serviços. Default: todos. */
  servicos?: number[]
}

export interface CotacaoResultado {
  /** ID interno do serviço no Melhor Envio. Use ao comprar etiqueta. */
  id: number
  /** Nome legível do serviço. Ex: "Correios PAC", "Jadlog .Package" */
  name: string
  /** Empresa transportadora. Ex: "Correios", "Jadlog", "Total Express" */
  company: string
  /** URL do logo (PNG, ~80px) */
  picture: string
  /** Preço final em reais */
  price: number
  /** Prazo em dias úteis */
  deliveryTime: number
  /** True se entrega no mesmo dia */
  isSameDay: boolean
  /** True se serviço disponível para a rota */
  available: boolean
  /** Mensagem de erro se available=false */
  error?: string
}

const ME_BASE_URL =
  process.env.MELHOR_ENVIO_URL || 'https://melhorenvio.com.br/api/v2'

const ME_USER_AGENT =
  process.env.MELHOR_ENVIO_USER_AGENT || 'Forza Motos contato@forzamotos.com.br'

function limparCEP(cep: string): string {
  return cep.replace(/\D/g, '')
}

/**
 * Cota frete via API do Melhor Envio.
 *
 * Lança erro se o token estiver ausente. Retorna lista vazia se a API
 * estiver fora ou se nenhum serviço estiver disponível para a rota.
 */
export async function cotarMelhorEnvio(input: CotacaoInput): Promise<CotacaoResultado[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado')

  const cepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM
  if (!cepOrigem) throw new Error('MELHOR_ENVIO_CEP_ORIGEM não configurado')

  const body = {
    from: { postal_code: limparCEP(cepOrigem) },
    to: { postal_code: limparCEP(input.cepDestino) },
    package: {
      // Melhor Envio espera weight em kg e dimensões em cm
      weight: input.dimensoes.peso,
      height: input.dimensoes.altura,
      width: input.dimensoes.largura,
      length: input.dimensoes.comprimento,
    },
    options: {
      insurance_value: input.valorTotal,
      receipt: false,
      own_hand: false,
    },
    ...(input.servicos && { services: input.servicos.join(',') }),
  }

  const res = await fetch(`${ME_BASE_URL}/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': ME_USER_AGENT,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Melhor Envio ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = (await res.json()) as any[]

  return data.map((s) => ({
    id: s.id,
    name: s.name,
    company: s.company?.name || 'Desconhecida',
    picture: s.company?.picture || '',
    price: Number(s.price ?? 0),
    deliveryTime: Number(s.delivery_time ?? s.custom_delivery_time ?? 0),
    isSameDay: Boolean(s.delivery_range?.min === 0),
    available: !s.error,
    error: s.error,
  }))
}

/**
 * Compra etiqueta no carrinho ME (passo 1 de 3 do envio).
 * Use APENAS no servidor (admin), nunca exponha pra cliente.
 */
export async function adicionarAoCarrinhoME(input: {
  servicoId: number
  cepDestino: string
  dimensoes: Dimensoes
  valorTotal: number
  destinatario: {
    nome: string
    email: string
    telefone: string
    documento: string // CPF
    enderecoCompleto: {
      rua: string
      numero: string
      complemento?: string
      bairro: string
      cidade: string
      estado: string
    }
  }
}) {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado')

  // Documentação completa: https://docs.melhorenvio.com.br/reference/inserir-frete-no-carrinho
  // Implementação real fica a cargo do admin — esta é só a estrutura base.
  const body = {
    service: input.servicoId,
    from: {
      postal_code: limparCEP(process.env.MELHOR_ENVIO_CEP_ORIGEM || ''),
    },
    to: {
      name: input.destinatario.nome,
      email: input.destinatario.email,
      phone: input.destinatario.telefone,
      document: input.destinatario.documento,
      postal_code: limparCEP(input.cepDestino),
      address: input.destinatario.enderecoCompleto.rua,
      number: input.destinatario.enderecoCompleto.numero,
      complement: input.destinatario.enderecoCompleto.complemento || '',
      district: input.destinatario.enderecoCompleto.bairro,
      city: input.destinatario.enderecoCompleto.cidade,
      state_abbr: input.destinatario.enderecoCompleto.estado,
    },
    products: [
      {
        name: 'Pedido Forza Motos',
        quantity: 1,
        unitary_value: input.valorTotal,
      },
    ],
    volumes: [
      {
        height: input.dimensoes.altura,
        width: input.dimensoes.largura,
        length: input.dimensoes.comprimento,
        weight: input.dimensoes.peso,
      },
    ],
    options: {
      insurance_value: input.valorTotal,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: false,
    },
  }

  const res = await fetch(`${ME_BASE_URL}/me/cart`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': ME_USER_AGENT,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Melhor Envio (carrinho) ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}
