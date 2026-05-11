interface OlistToken {
  access_token: string
  expires_at: number
}

let tokenCache: OlistToken | null = null

async function getToken(): Promise<string> {
  // Token estático por enquanto; trocar por OAuth flow quando credenciais chegarem
  const staticToken = process.env.OLIST_TOKEN
  if (staticToken) return staticToken

  if (tokenCache && tokenCache.expires_at > Date.now()) {
    return tokenCache.access_token
  }

  const res = await fetch('https://accounts.olist.com/oauth20/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OLIST_CLIENT_ID!,
      client_secret: process.env.OLIST_CLIENT_SECRET!,
    }),
  })

  if (!res.ok) throw new Error('Falha ao obter token OLIST')

  const data = await res.json()
  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000,
  }

  return tokenCache.access_token
}

export async function olistFetch(path: string, options: RequestInit = {}) {
  const token = await getToken()

  const res = await fetch(`https://api.olist.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`OLIST API erro ${res.status}: ${erro}`)
  }

  return res.json()
}
