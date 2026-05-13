/**
 * Cliente API Tiny.com.br v2
 * Rate limit: Tiny bloqueia acesso excessivo. Respeitamos com delay entre calls.
 */

const BASE_URL = 'https://api.tiny.com.br/api2'

function getToken(): string {
  const token = process.env.OLIST_TOKEN
  if (!token) throw new Error('OLIST_TOKEN não configurado')
  return token
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface TinyResponse {
  retorno: {
    status: string
    paginas?: number
    numero_paginas?: number
    id?: string | number
    produtos?: any[]
    produto?: any
    pedidos?: any[]
    pedido?: any
    registros?: any[]
    erros?: any[]
    erro?: string
  }
}

/** Faz uma requisição POST form-encoded para a API do Tiny */
export async function tinyFetch(
  endpoint: string,
  params: Record<string, string | number> = {},
  delayMs = 800
): Promise<TinyResponse> {
  await sleep(delayMs)

  const body = new URLSearchParams({
    token: getToken(),
    formato: 'JSON',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) throw new Error(`Tiny HTTP ${res.status}`)

  const data: TinyResponse = await res.json()

  if (data.retorno?.status === 'Erro') {
    const msg = data.retorno.erro || JSON.stringify(data.retorno.erros)
    throw new Error(`Tiny API: ${msg}`)
  }

  return data
}

/**
 * Busca UMA página da listagem de produtos
 * A listagem inclui: id, codigo, nome, preco, situacao, saldo (estoque)
 */
export async function fetchTinyProductPage(pagina: number): Promise<{ produtos: any[]; totalPaginas: number }> {
  // delayMs=0 — listagem paginada não sofre rate limit como produto.obter.php
  const data = await tinyFetch('produtos.pesquisa.php', { pagina, situacao: 'A' }, 0)
  const produtos = (data.retorno?.produtos ?? []).map((p: any) => p.produto ?? p)
  const totalPaginas = Number(data.retorno?.numero_paginas ?? data.retorno?.paginas ?? 1)
  return { produtos, totalPaginas }
}

/**
 * Busca detalhes completos de 1 produto (inclui fotos/imagens)
 * Só use para produtos sem imagem — delay alto para não bloquear
 */
export async function fetchTinyProduct(id: string | number): Promise<any> {
  const data = await tinyFetch('produto.obter.php', { id: String(id) }, 1200)
  return data.retorno?.produto ?? null
}

/**
 * Busca estoque real de 1 produto usando depósito "Loja" (estoque físico da Forza).
 * Depósitos Drop_EuroLaqui e F_drop são dropshipping — sempre 0 no Tiny,
 * mas o produto é disponível via fornecedor. Nesses casos retornamos 999 (disponível).
 *
 * Retorna:
 *   > 0  → estoque físico real da Loja
 *   999  → dropshipping (ativo, sem estoque próprio — disponível pelo fornecedor)
 *   0    → produto inativo/sem disponibilidade
 *   -1   → erro de API (não alterar valor atual)
 */
export async function fetchTinyProductEstoque(id: string | number): Promise<number> {
  try {
    const data = await tinyFetch('produto.obter.estoque.php', { id: String(id) }, 1200)
    const raw = data.retorno?.produto?.depositos ?? []
    const lista: any[] = Array.isArray(raw)
      ? raw
      : (raw.deposito ? [raw.deposito].flat() : [])

    const DEPOSITOS_DROPSHIP = ['drop_eurolaqu', 'f_drop', 'eurolaqui', 'drop']
    let saldoLoja = 0
    let temDropship = false

    for (const item of lista) {
      const dep = item.deposito ?? item
      const nomeDeposito = (dep.nome ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
      const saldo = Number(dep.saldo ?? dep.quantidade ?? 0)

      if (nomeDeposito === 'loja') {
        saldoLoja += saldo
      } else if (DEPOSITOS_DROPSHIP.some(d => nomeDeposito.includes(d))) {
        temDropship = true
      }
    }

    // Tem estoque físico real → retorna número exato
    if (saldoLoja > 0) return saldoLoja

    // Dropshipping: fornecedor garante disponibilidade, produto ativo → 999
    if (temDropship) return 999

    // Nenhum depósito conhecido com saldo → soma geral como fallback
    const total = lista.reduce((acc: number, item: any) => {
      const dep = item.deposito ?? item
      return acc + Number(dep.saldo ?? dep.quantidade ?? 0)
    }, 0)
    return Math.max(0, total)
  } catch {
    return -1
  }
}

/** Extrair URLs de imagem de um produto retornado pelo produto.obter.php */
export function extrairImagensTiny(p: any): string[] {
  if (!p) return []

  // Formato: produto.fotos.foto[] ou produto.fotos[]
  if (p.fotos) {
    const raw = p.fotos.foto ?? p.fotos
    const lista = Array.isArray(raw) ? raw : (raw ? [raw] : [])
    const urls = lista.map((f: any) => (typeof f === 'string' ? f : f?.url || f?.link || '')).filter(Boolean)
    if (urls.length) return urls
  }

  // Formato: produto.imagens.imagem[] ou produto.imagens[]
  if (p.imagens) {
    const raw = p.imagens.imagem ?? p.imagens
    const lista = Array.isArray(raw) ? raw : (raw ? [raw] : [])
    const urls = lista.map((i: any) => (typeof i === 'string' ? i : i?.url || i?.link || '')).filter(Boolean)
    if (urls.length) return urls
  }

  // Formato: produto.imagens_externas (Tiny v2)
  if (p.imagens_externas && Array.isArray(p.imagens_externas) && p.imagens_externas.length > 0) {
    const urls = p.imagens_externas
      .map((i: any) => (typeof i === 'string' ? i : i?.url || i?.link || i?.endereco || ''))
      .filter(Boolean)
    if (urls.length) return urls
  }

  if (typeof p.foto === 'string' && p.foto) return [p.foto]
  if (typeof p.imagem_principal === 'string' && p.imagem_principal) return [p.imagem_principal]

  return []
}
