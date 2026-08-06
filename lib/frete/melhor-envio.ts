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

// Lidas dentro das funções para garantir runtime env (evita inlining build-time)
const getMeBaseUrl = () =>
  process.env.MELHOR_ENVIO_URL || 'https://www.melhorenvio.com.br/api/v2'

const getMeUserAgent = () =>
  process.env.MELHOR_ENVIO_USER_AGENT || 'Forza Motos caio@forzamotos.com.br'

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

  const res = await fetch(`${getMeBaseUrl()}/me/shipment/calculate`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': getMeUserAgent(),
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

  // Documentação: https://docs.melhorenvio.com.br/reference/inserir-frete-no-carrinho
  //
  // O remetente NÃO pode vir só com o CEP: a API recusa com
  // "O campo from.name é obrigatório" (+ from.address e from.city). Testado
  // contra a API real em 06/08/2026 — antes disso esta função nunca tinha sido
  // executada e não funcionava.
  const body = {
    service: input.servicoId,
    from: {
      name: process.env.LOJA_NOME || 'Forza Motos',
      phone: (process.env.LOJA_TELEFONE || '19974049445').replace(/\D/g, ''),
      email: process.env.LOJA_EMAIL || 'caio@forzamotos.com.br',
      address: process.env.LOJA_RUA || 'Rua Funilense',
      number: process.env.LOJA_NUMERO || '110',
      complement: process.env.LOJA_COMPLEMENTO || '',
      district: process.env.LOJA_BAIRRO || 'Guanabara',
      city: process.env.LOJA_CIDADE || 'Campinas',
      state_abbr: process.env.LOJA_UF || 'SP',
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

  const res = await fetch(`${getMeBaseUrl()}/me/cart`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': getMeUserAgent(),
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Melhor Envio (carrinho) ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}

/**
 * Chamada autenticada genérica ao Melhor Envio — usada pelos passos de envio
 * (checkout/generate/print/tracking), que compartilham headers e tratamento de erro.
 */
async function meFetch(caminho: string, body: unknown): Promise<any> {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado')

  const res = await fetch(`${getMeBaseUrl()}${caminho}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': getMeUserAgent(),
    },
    body: JSON.stringify(body),
  })

  const texto = await res.text()
  if (!res.ok) {
    throw new Error(`Melhor Envio (${caminho}) ${res.status}: ${texto.slice(0, 300)}`)
  }
  try {
    return JSON.parse(texto)
  } catch {
    return {}
  }
}

/**
 * Passo 2 de 4: COMPRA as etiquetas do carrinho — debita o saldo da conta ME.
 *
 * Esta é a única função do fluxo que gasta dinheiro. Por isso ela só é chamada
 * a partir do endpoint de admin (clique manual), nunca automaticamente quando
 * o pedido é pago. Saldo insuficiente faz a API devolver erro.
 */
export async function comprarEtiquetasME(ids: string[]): Promise<any> {
  return meFetch('/me/shipment/checkout', { orders: ids })
}

/** Passo 3 de 4: gera a etiqueta (vira PDF imprimível). */
export async function gerarEtiquetasME(ids: string[]): Promise<any> {
  return meFetch('/me/shipment/generate', { orders: ids })
}

/** Passo 4 de 4: devolve a URL do PDF da etiqueta. */
export async function imprimirEtiquetasME(ids: string[]): Promise<{ url?: string }> {
  return meFetch('/me/shipment/print', { mode: 'private', orders: ids })
}

/**
 * Consulta rastreio das etiquetas. Devolve um mapa id → dados, do jeito que a
 * API responde (chaveado pelo id do envio).
 */
export async function rastrearEtiquetasME(ids: string[]): Promise<Record<string, any>> {
  return meFetch('/me/shipment/tracking', { orders: ids })
}
