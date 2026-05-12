/**
 * Cliente para a API Tiny.com.br (v2)
 * Documentação: https://tiny.com.br/api-docs/api
 *
 * Autenticação: token enviado como parâmetro em cada request
 * Base URL: https://api.tiny.com.br/api2/
 */

const BASE_URL = 'https://api.tiny.com.br/api2'

function getToken(): string {
  const token = process.env.OLIST_TOKEN
  if (!token) throw new Error('OLIST_TOKEN não configurado nas variáveis de ambiente')
  return token
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
    registros?: any[]
    erros?: any[]
    erro?: string
  }
}

/**
 * Faz uma requisição à API do Tiny
 * Todos os endpoints usam POST com form-encoded body
 */
export async function tinyFetch(endpoint: string, params: Record<string, string | number> = {}): Promise<TinyResponse> {
  const token = getToken()

  const body = new URLSearchParams({
    token,
    formato: 'JSON',
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  })

  const res = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new Error(`Tiny API erro HTTP ${res.status}: ${await res.text()}`)
  }

  const data: TinyResponse = await res.json()

  if (data.retorno?.status === 'Erro') {
    const msg = data.retorno.erro || JSON.stringify(data.retorno.erros)
    throw new Error(`Tiny API erro: ${msg}`)
  }

  return data
}

/**
 * Busca lista de produtos com paginação automática
 */
export async function fetchAllTinyProducts(): Promise<any[]> {
  const todos: any[] = []
  let pagina = 1

  while (true) {
    const data = await tinyFetch('produtos.pesquisa.php', {
      pagina,
      situacao: 'A', // apenas produtos Ativos
    })

    const produtos = data.retorno?.produtos ?? []
    if (!produtos.length) break

    // cada item da lista é { produto: { id, nome, ... } }
    todos.push(...produtos.map((p: any) => p.produto ?? p))

    const totalPaginas = Number(data.retorno?.numero_paginas ?? data.retorno?.paginas ?? 1)
    if (pagina >= totalPaginas) break
    pagina++
  }

  return todos
}

/**
 * Busca detalhes completos de um produto pelo ID do Tiny
 */
export async function fetchTinyProduct(id: string | number): Promise<any> {
  const data = await tinyFetch('produto.obter.php', { id: String(id) })
  return data.retorno?.produto ?? null
}
