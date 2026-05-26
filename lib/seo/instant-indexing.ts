/**
 * Google Indexing API — notifica o Google quando uma URL é criada/atualizada/removida.
 *
 * Setup (uma vez):
 * 1. Crie um Service Account no Google Cloud Console
 * 2. Habilite "Web Search Indexing API" no projeto
 * 3. No Search Console, adicione o e-mail do service account como Proprietário
 * 4. Baixe o JSON da chave e cole o conteúdo na env GOOGLE_INDEXING_CREDENTIALS
 *
 * Limite: 200 URLs/dia por projeto (cota padrão).
 *
 * Uso:
 *   import { notifyGoogleIndexing } from '@/lib/seo/instant-indexing'
 *
 *   // Após publicar um produto/post:
 *   await notifyGoogleIndexing(`${SEO_CONFIG.siteUrl}/produtos/${slug}`, 'URL_UPDATED')
 *
 *   // Após despublicar/deletar:
 *   await notifyGoogleIndexing(url, 'URL_DELETED')
 */

import { SignJWT, importPKCS8 } from 'jose'

type IndexingAction = 'URL_UPDATED' | 'URL_DELETED'

interface ServiceAccountCreds {
  client_email: string
  private_key: string
  token_uri?: string
}

function getCreds(): ServiceAccountCreds {
  const raw = process.env.GOOGLE_INDEXING_CREDENTIALS
  if (!raw) throw new Error('GOOGLE_INDEXING_CREDENTIALS não configurada')
  return JSON.parse(raw)
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  // Reutiliza token se ainda válido (com margem de 5 min)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token
  }

  const creds = getCreds()
  const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token'

  const now = Math.floor(Date.now() / 1000)
  const privateKey = await importPKCS8(creds.private_key, 'RS256')

  const jwt = await new SignJWT({
    scope: 'https://www.googleapis.com/auth/indexing',
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(creds.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey)

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Falha ao obter token Google: ${res.status} ${text}`)
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return json.access_token
}

/**
 * Notifica o Google Indexing API.
 * Retorna `{ ok: true }` em sucesso ou `{ ok: false, error }` em falha (não lança).
 */
export async function notifyGoogleIndexing(
  url: string,
  action: IndexingAction = 'URL_UPDATED'
): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await getAccessToken()
    const res = await fetch(
      'https://indexing.googleapis.com/v3/urlNotifications:publish',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url, type: action }),
      }
    )
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}

/**
 * Notifica IndexNow (Bing/Yandex/etc) — alternativa simples sem service account.
 * Coloque INDEXNOW_KEY na .env (32+ chars random). Crie também o arquivo
 *   public/<INDEXNOW_KEY>.txt  com o conteúdo igual à própria key.
 */
export async function notifyIndexNow(urls: string[]): Promise<{ ok: boolean; error?: string }> {
  const key = process.env.INDEXNOW_KEY
  const host = process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  if (!key || !host) return { ok: false, error: 'INDEXNOW_KEY ou host ausente' }

  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `https://${host}/${key}.txt`,
        urlList: urls,
      }),
    })
    if (!res.ok) {
      return { ok: false, error: `${res.status}: ${await res.text()}` }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) }
  }
}
