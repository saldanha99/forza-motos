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
import { exigirChaveNfe, exigirInscricaoEstadual } from './nfe'

export interface CotacaoInput {
  cepDestino: string
  /** Dimensões agregadas do carrinho */
  dimensoes: Dimensoes
  /** Valor total do pedido (para seguro). Em reais. */
  valorTotal: number
}

/** Serviços oferecidos pela loja: Correios PAC (1) e SEDEX (2). */
export const SERVICOS_CORREIOS_LOJA = [1, 2] as const
const IDS_SERVICOS_CORREIOS_LOJA = new Set<number>(SERVICOS_CORREIOS_LOJA)

/** Defesa adicional caso a API devolva um serviço fora do filtro solicitado. */
export function servicoCorreiosHabilitado(input: {
  id: number
  companyId?: number
}): boolean {
  return IDS_SERVICOS_CORREIOS_LOJA.has(Number(input.id)) && Number(input.companyId) === 1
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

// Muito abaixo do lease de 5 minutos: uma rede travada não pode permitir que
// outro processo adquira o lease enquanto a primeira chamada ainda está viva.
const TIMEOUT_PREPARO_MS = 30_000
const TIMEOUT_CONSULTA_MS = 8_000
const MAX_PDF_BYTES = 20 * 1024 * 1024
const MAX_JSON_PDF_BYTES = 64 * 1024
const MAX_REDIRECTS_PDF = 3

export class ErroMelhorEnvio extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly caminho: string,
  ) {
    super(message)
    this.name = 'ErroMelhorEnvio'
  }
}

/** Erros em que a API pode ter processado a compra antes de a resposta falhar. */
export function resultadoCompraPodeSerIncerto(error: unknown): boolean {
  if (!(error instanceof ErroMelhorEnvio)) return true
  return error.status === null || error.status === 408 || error.status === 425 ||
    error.status === 429 || error.status >= 500
}

function limparCEP(cep: string): string {
  return cep.replace(/\D/g, '')
}

/**
 * O fluxo atual não coleta agência nem XML fiscal no checkout. Serviços que
 * exigem esses campos não devem ser oferecidos até a integração ser ampliada.
 */
const SERVICOS_COM_DADOS_ADICIONAIS = new Set([12, 15, 16, 22])
const EMPRESAS_COM_DADOS_ADICIONAIS = new Set([6, 9, 12])

export function servicoCompativelComFluxo(input: { id: number; companyId?: number }): boolean {
  return !SERVICOS_COM_DADOS_ADICIONAIS.has(Number(input.id)) &&
    !EMPRESAS_COM_DADOS_ADICIONAIS.has(Number(input.companyId))
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
    services: SERVICOS_CORREIOS_LOJA.join(','),
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

  return data.filter((s) => (
    servicoCorreiosHabilitado({
      id: Number(s.id),
      companyId: s.company?.id == null ? undefined : Number(s.company.id),
    }) &&
    servicoCompativelComFluxo({
      id: Number(s.id),
      companyId: s.company?.id == null ? undefined : Number(s.company.id),
    })
  )).map((s) => ({
    id: s.id,
    name: s.name,
    company: s.company?.name || 'Desconhecida',
    picture: s.company?.picture || '',
    price: Number(s.custom_price ?? s.price ?? 0),
    deliveryTime: Number(s.custom_delivery_time ?? s.delivery_time ?? 0),
    isSameDay: Boolean(s.delivery_range?.min === 0),
    available: !s.error,
    error: s.error,
  })).filter(servicoCompativelComFluxo)
}

/**
 * Compra etiqueta no carrinho ME (passo 1 de 3 do envio).
 * Use APENAS no servidor (admin), nunca exponha pra cliente.
 */
export async function adicionarAoCarrinhoME(input: {
  servicoId: number
  cepDestino: string
  /** Chave fiscal do documento emitido para esta venda comercial. */
  nfeChave: string
  dimensoes: Dimensoes
  valorTotal: number
  produtos: Array<{ nome: string; quantidade: number; valorUnitario: number }>
  referencia: { tag: string; url?: string | null }
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

  const nfeChave = exigirChaveNfe(input.nfeChave)
  const inscricaoEstadual = exigirInscricaoEstadual(process.env.LOJA_INSCRICAO_ESTADUAL)

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
      company_document: limparCEP(process.env.LOJA_CNPJ || '00857031000163'),
      state_register: inscricaoEstadual,
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
    products: input.produtos.map((produto) => ({
      name: produto.nome.slice(0, 255),
      quantity: produto.quantidade,
      unitary_value: produto.valorUnitario,
    })),
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
      invoice: { key: nfeChave },
      platform: 'Forza Motos',
      reminder: input.referencia.tag,
      tags: [{ tag: input.referencia.tag, url: input.referencia.url ?? null }],
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
    signal: AbortSignal.timeout(TIMEOUT_PREPARO_MS),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Melhor Envio (carrinho) ${res.status}: ${text.slice(0, 200)}`)
  }

  return res.json()
}

/**
 * Recupera um envio já inserido antes de uma queda entre a resposta do ME e a
 * persistência local. A tag do pedido é estável e também facilita conferência
 * manual no painel do Melhor Envio.
 */
export async function buscarEnvioNoCarrinhoPorTag(tag: string): Promise<string | null> {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado')

  const res = await fetch(`${getMeBaseUrl()}/me/cart`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': getMeUserAgent(),
    },
    signal: AbortSignal.timeout(TIMEOUT_PREPARO_MS),
  })
  if (!res.ok) {
    const texto = await res.text()
    throw new Error(`Melhor Envio (listar carrinho) ${res.status}: ${texto.slice(0, 200)}`)
  }

  const resposta = await res.json()
  const itens: any[] = Array.isArray(resposta)
    ? resposta
    : Array.isArray(resposta?.data)
      ? resposta.data
      : Array.isArray(resposta?.results)
        ? resposta.results
        : []

  const encontrado = itens.find((item) => {
    const tags = Array.isArray(item?.tags)
      ? item.tags
      : Array.isArray(item?.options?.tags)
        ? item.options.tags
        : []
    return tags.some((entrada: any) => String(entrada?.tag ?? entrada) === tag)
  })
  return encontrado?.id ? String(encontrado.id) : null
}

/** Consulta o estado remoto para recuperar uma compra cujo HTTP/DB foi incerto. */
export async function consultarEnvioME(id: string): Promise<any | null> {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado')

  const res = await fetch(`${getMeBaseUrl()}/me/orders/${encodeURIComponent(id)}`, {
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': getMeUserAgent(),
    },
    signal: AbortSignal.timeout(TIMEOUT_CONSULTA_MS),
  })
  if (res.status === 404) return null
  const texto = await res.text()
  if (!res.ok) {
    throw new Error(`Melhor Envio (consultar etiqueta) ${res.status}: ${texto.slice(0, 200)}`)
  }
  try {
    return JSON.parse(texto)
  } catch {
    return {}
  }
}

/**
 * Chamada autenticada genérica ao Melhor Envio — usada pelos passos de envio
 * (checkout/generate/print/tracking), que compartilham headers e tratamento de erro.
 */
async function meFetch(caminho: string, body: unknown): Promise<any> {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado')

  let res: Response
  try {
    res = await fetch(`${getMeBaseUrl()}${caminho}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': getMeUserAgent(),
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new ErroMelhorEnvio(
      `Melhor Envio (${caminho}) não respondeu: ${error instanceof Error ? error.message : 'falha de rede'}`,
      null,
      caminho,
    )
  }

  const texto = await res.text()
  if (!res.ok) {
    throw new ErroMelhorEnvio(
      `Melhor Envio (${caminho}) ${res.status}: ${texto.slice(0, 300)}`,
      res.status,
      caminho,
    )
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

function hostPdfMelhorEnvioPermitido(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'melhorenvio.com.br' || host.endsWith('.melhorenvio.com.br')) return true
  return host === 's3.amazonaws.com' ||
    /\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(host)
}

/**
 * A API antiga de impressão pode responder JSON no formato `["https://..."]`
 * mesmo quando o cliente pede PDF. Só aceitamos destinos HTTPS do Melhor
 * Envio/S3 e caminhos de PDF, evitando transformar este download em SSRF.
 */
export function extrairUrlPdfMelhorEnvio(payload: unknown): string | null {
  let candidata: unknown = payload
  if (Array.isArray(payload)) candidata = payload[0]
  else if (payload && typeof payload === 'object') {
    const objeto = payload as Record<string, unknown>
    candidata = objeto.url ?? objeto.pdf ?? objeto.link ??
      (Array.isArray(objeto.data) ? objeto.data[0] : objeto.data)
  }
  if (typeof candidata !== 'string') return null

  try {
    const url = new URL(candidata)
    const caminhoPdf = url.pathname.toLowerCase()
    if (url.protocol !== 'https:' || !hostPdfMelhorEnvioPermitido(url.hostname)) return null
    if (!caminhoPdf.endsWith('.pdf') && !caminhoPdf.includes('/pdf/')) return null
    return url.toString()
  } catch {
    return null
  }
}

function conteudoEhPdf(conteudo: ArrayBuffer): boolean {
  const inicio = new Uint8Array(conteudo.slice(0, 5))
  return inicio.length === 5 && String.fromCharCode(...inicio) === '%PDF-'
}

async function lerComLimite(
  resposta: Response,
  limite: number,
  caminho: string,
): Promise<ArrayBuffer> {
  const tamanhoInformado = Number(resposta.headers.get('content-length') ?? 0)
  if (Number.isFinite(tamanhoInformado) && tamanhoInformado > limite) {
    throw new ErroMelhorEnvio('Arquivo da etiqueta excede o tamanho permitido', 502, caminho)
  }
  if (!resposta.body) return new ArrayBuffer(0)

  const leitor = resposta.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > limite) {
      await leitor.cancel().catch(() => {})
      throw new ErroMelhorEnvio('Arquivo da etiqueta excede o tamanho permitido', 502, caminho)
    }
    partes.push(value)
  }

  const conteudo = new Uint8Array(total)
  let offset = 0
  for (const parte of partes) {
    conteudo.set(parte, offset)
    offset += parte.byteLength
  }
  return conteudo.buffer
}

async function baixarUrlPdfSeguro(urlInicial: string, caminho: string): Promise<Response> {
  let urlAtual = urlInicial
  for (let tentativa = 0; tentativa <= MAX_REDIRECTS_PDF; tentativa += 1) {
    const urlValidada = extrairUrlPdfMelhorEnvio(urlAtual)
    if (!urlValidada) {
      throw new ErroMelhorEnvio('O download da etiqueta apontou para um destino inválido', 502, caminho)
    }

    let resposta: Response
    try {
      resposta = await fetch(urlValidada, {
        headers: { 'Accept': 'application/pdf' },
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_PREPARO_MS),
      })
    } catch (error) {
      throw new ErroMelhorEnvio(
        `O arquivo temporário da etiqueta não respondeu: ${error instanceof Error ? error.message : 'falha de rede'}`,
        null,
        caminho,
      )
    }

    if (![301, 302, 303, 307, 308].includes(resposta.status)) return resposta
    const location = resposta.headers.get('location')
    if (!location) {
      throw new ErroMelhorEnvio('Redirecionamento do PDF sem destino', 502, caminho)
    }
    urlAtual = new URL(location, urlValidada).toString()
  }
  throw new ErroMelhorEnvio('O download da etiqueta excedeu o limite de redirecionamentos', 502, caminho)
}

/**
 * Baixa o PDF pelo servidor para não expor o token nem depender de uma sessão
 * do administrador aberta no site do Melhor Envio.
 */
export async function baixarEtiquetaPdfME(id: string): Promise<{
  conteudo: ArrayBuffer
  contentType: string
}> {
  const token = process.env.MELHOR_ENVIO_TOKEN
  if (!token) throw new Error('MELHOR_ENVIO_TOKEN não configurado')

  const caminho = `/me/imprimir/pdf/${encodeURIComponent(id)}`
  let res: Response
  try {
    res = await fetch(`${getMeBaseUrl()}${caminho}`, {
      headers: {
        'Accept': 'application/pdf',
        'Authorization': `Bearer ${token}`,
        'User-Agent': getMeUserAgent(),
      },
      signal: AbortSignal.timeout(TIMEOUT_PREPARO_MS),
    })
  } catch (error) {
    throw new ErroMelhorEnvio(
      `Melhor Envio (${caminho}) não respondeu: ${error instanceof Error ? error.message : 'falha de rede'}`,
      null,
      caminho,
    )
  }

  if (!res.ok) {
    const texto = await res.text()
    throw new ErroMelhorEnvio(
      `Melhor Envio (${caminho}) ${res.status}: ${texto.slice(0, 300)}`,
      res.status,
      caminho,
    )
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    const conteudo = await lerComLimite(res, MAX_PDF_BYTES, caminho)
    if (!conteudoEhPdf(conteudo)) {
      throw new ErroMelhorEnvio('Melhor Envio devolveu um arquivo que não é PDF', 502, caminho)
    }
    return { conteudo, contentType: 'application/pdf' }
  }

  const texto = new TextDecoder().decode(await lerComLimite(res, MAX_JSON_PDF_BYTES, caminho))
  let payload: unknown
  try {
    payload = JSON.parse(texto)
  } catch {
    throw new ErroMelhorEnvio('Melhor Envio não devolveu o PDF da etiqueta', 502, caminho)
  }
  const urlPdf = extrairUrlPdfMelhorEnvio(payload)
  if (!urlPdf) {
    throw new ErroMelhorEnvio('Melhor Envio devolveu um link de PDF inválido', 502, caminho)
  }

  const download = await baixarUrlPdfSeguro(urlPdf, caminho)
  if (!download.ok) {
    throw new ErroMelhorEnvio(
      `O arquivo temporário da etiqueta respondeu ${download.status}`,
      download.status,
      caminho,
    )
  }
  const conteudo = await lerComLimite(download, MAX_PDF_BYTES, caminho)
  if (!conteudoEhPdf(conteudo)) {
    throw new ErroMelhorEnvio('O arquivo temporário devolvido não é um PDF válido', 502, caminho)
  }
  return { conteudo, contentType: 'application/pdf' }
}
