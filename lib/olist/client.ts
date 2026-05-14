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
 * Busca atualizações de ESTOQUE da fila delta (extensão "API para estoque em tempo real")
 * Retorna só os produtos cujo estoque mudou desde dataAlteracao.
 * IMPORTANTE: registros lidos são removidos da fila automaticamente.
 */
export async function fetchTinyEstoqueDelta(
  dataAlteracao: string,
  pagina = 1
): Promise<{ produtos: any[]; totalPaginas: number }> {
  const data = await tinyFetch('lista.atualizacoes.estoque', { dataAlteracao, pagina }, 0)
  const produtos = (data.retorno?.produtos ?? []).map((p: any) => p.produto ?? p)
  const totalPaginas = Number(data.retorno?.numero_paginas ?? data.retorno?.paginas ?? 1)
  return { produtos, totalPaginas }
}

/**
 * Busca produtos ALTERADOS da fila delta (extensão "API para estoque em tempo real")
 * Retorna produtos com qualquer mudança (preço, nome, situação) desde dataAlteracao.
 * IMPORTANTE: registros lidos são removidos da fila automaticamente.
 */
export async function fetchTinyProdutosDelta(
  dataAlteracao: string,
  pagina = 1
): Promise<{ produtos: any[]; totalPaginas: number }> {
  const data = await tinyFetch('lista.atualizacoes.produtos', { dataAlteracao, pagina }, 0)
  const produtos = (data.retorno?.produtos ?? []).map((p: any) => p.produto ?? p)
  const totalPaginas = Number(data.retorno?.numero_paginas ?? data.retorno?.paginas ?? 1)
  return { produtos, totalPaginas }
}

/** Helper: retorna data formatada dd/mm/yyyy HH:MM:SS para N dias atrás */
export function dataDiasAtras(dias: number): string {
  const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}:${ss}`
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

/**
 * Extrair URLs de imagem de um produto retornado pelo produto.obter.php
 * Suporta todos os formatos conhecidos do Tiny API v2
 */
export function extrairImagensTiny(p: any): string[] {
  if (!p) return []

  const urls: string[] = []

  // Helper: normaliza item de foto para URL
  function toUrl(item: any): string {
    if (!item) return ''
    if (typeof item === 'string') return item
    return item.url || item.link || item.endereco || item.src || item.path || ''
  }

  // Helper: transforma campo em array de urls
  function extrairArray(campo: any): string[] {
    if (!campo) return []
    // Já é um array?
    if (Array.isArray(campo)) return campo.map(toUrl).filter(Boolean)
    // É um objeto com sub-campo?
    const subCampos = ['foto', 'imagem', 'image', 'item']
    for (const sub of subCampos) {
      if (campo[sub] !== undefined) {
        const sub_raw = campo[sub]
        const sub_lista = Array.isArray(sub_raw) ? sub_raw : [sub_raw]
        const sub_urls = sub_lista.map(toUrl).filter(Boolean)
        if (sub_urls.length) return sub_urls
      }
    }
    // É um objeto simples (foto única)?
    const u = toUrl(campo)
    if (u) return [u]
    return []
  }

  // 1. Campo "fotos" (mais comum no Tiny API v2)
  if (p.fotos) urls.push(...extrairArray(p.fotos))
  if (urls.length) return urls

  // 2. Campo "imagens"
  if (p.imagens) urls.push(...extrairArray(p.imagens))
  if (urls.length) return urls

  // 3. Imagens externas (Tiny v2 — produtos com foto hospedada fora)
  if (p.imagens_externas) urls.push(...extrairArray(p.imagens_externas))
  if (urls.length) return urls

  // 4. Campos de foto única
  if (typeof p.foto === 'string' && p.foto) return [p.foto]
  if (typeof p.imagem_principal === 'string' && p.imagem_principal) return [p.imagem_principal]
  if (typeof p.url_imagem === 'string' && p.url_imagem) return [p.url_imagem]
  if (typeof p.imagem === 'string' && p.imagem) return [p.imagem]

  return []
}
