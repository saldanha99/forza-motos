/**
 * Cliente para a API Tiny.com.br (v2)
 * Autenticação: token enviado como parâmetro POST em cada request
 * Base URL: https://api.tiny.com.br/api2/
 *
 * Rate limit: Tiny bloqueia acesso excessivo — respeitamos com delay entre chamadas
 */

const BASE_URL = 'https://api.tiny.com.br/api2'

/** Delay mínimo entre requests (ms) — evita bloqueio por rate limit */
const REQUEST_DELAY_MS = 600

function getToken(): string {
  const token = process.env.OLIST_TOKEN
  if (!token) throw new Error('OLIST_TOKEN não configurado nas variáveis de ambiente')
  return token
}

/** Pausa para respeitar o rate limit do Tiny */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface TinyResponse {
  retorno: {
    status: string
    status_processamento?: string
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

/**
 * Faz uma requisição à API do Tiny com delay automático
 */
export async function tinyFetch(endpoint: string, params: Record<string, string | number> = {}): Promise<TinyResponse> {
  const token = getToken()

  const body = new URLSearchParams({
    token,
    formato: 'JSON',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  // Delay entre requests para respeitar rate limit
  await sleep(REQUEST_DELAY_MS)

  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`Tiny API HTTP ${res.status}: ${await res.text()}`)
  }

  const data: TinyResponse = await res.json()

  if (data.retorno?.status === 'Erro') {
    const msg = data.retorno.erro || JSON.stringify(data.retorno.erros)
    throw new Error(`Tiny API erro: ${msg}`)
  }

  return data
}

/**
 * Busca lista COMPLETA de produtos com paginação automática
 * A listagem já inclui: id, codigo (sku), nome, preco, situacao, saldo (estoque)
 * Usa delay entre páginas para respeitar rate limit
 */
export async function fetchAllTinyProducts(): Promise<any[]> {
  const todos: any[] = []
  let pagina = 1

  while (true) {
    const data = await tinyFetch('produtos.pesquisa.php', {
      pagina,
      situacao: 'A', // apenas Ativos
    })

    const produtos = data.retorno?.produtos ?? []
    if (!produtos.length) break

    // cada item vem como { produto: { id, nome, ... } }
    todos.push(...produtos.map((p: any) => p.produto ?? p))

    const totalPaginas = Number(data.retorno?.numero_paginas ?? data.retorno?.paginas ?? 1)
    if (pagina >= totalPaginas) break
    pagina++
  }

  return todos
}

/**
 * Busca detalhes completos de um produto pelo ID
 * Inclui: fotos, descricao_complementar, obs, marca, categoria, etc.
 * Só use para produtos NOVOS (que ainda não existem no banco)
 */
export async function fetchTinyProduct(id: string | number): Promise<any> {
  const data = await tinyFetch('produto.obter.php', { id: String(id) })
  return data.retorno?.produto ?? null
}

/**
 * Busca APENAS estoque de um produto pelo ID
 * Endpoint mais leve para atualizar só o saldo
 */
export async function fetchTinyEstoque(id: string | number): Promise<number> {
  try {
    const data = await tinyFetch('produto.obter.estoque.php', { id: String(id) })
    const estoque = data.retorno?.produto
    return Number(estoque?.saldo_fisico_total ?? estoque?.saldo ?? 0)
  } catch {
    return 0
  }
}
