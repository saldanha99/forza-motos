/**
 * Trava de runtime do 2time SEO.
 *
 * Chamada no início das rotas de valor (geração de IA). Verifica, contra o
 * servidor de licenças, se este código está ativo E se o domínio que está
 * servindo a aplicação confere com o domínio licenciado.
 *
 * Pontos importantes:
 * - O domínio comparado vem do HOST REAL da requisição (req.headers.get('host')),
 *   não do arquivo de credencial. Copiar o .2time-license.json para outro site
 *   não burla: visitantes reais enviam Host: outrodominio.com.
 * - Cache de 24h em memória para não bater no servidor a cada request.
 * - Fail-open em queda de rede do servidor de licenças (uma indisponibilidade
 *   nossa NÃO derruba o site do cliente), fail-closed em resposta de recusa.
 *
 * Credenciais: lidas de variáveis de ambiente (preferido em produção/Vercel) ou,
 * em fallback, do arquivo .2time-license.json criado pelo instalador.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

type Cred = { code: string; domain: string; server: string }

const TTL_MS = 24 * 60 * 60 * 1000 // 24h
const cache = new Map<string, { valid: boolean; at: number }>()

let credCache: Cred | null | undefined

function lerCredenciais(): Cred | null {
  if (credCache !== undefined) return credCache

  // 1) Variáveis de ambiente (recomendado em produção).
  const envCode = process.env.TIME2_LICENSE_CODE
  const envServer = process.env.TIME2_LICENSE_SERVER || 'https://2time-license-server.vercel.app'
  if (envCode) {
    credCache = { code: envCode, domain: process.env.TIME2_LICENSE_DOMAIN || '', server: envServer }
    return credCache
  }

  // 2) Fallback: arquivo gravado pelo instalador.
  try {
    const raw = readFileSync(join(process.cwd(), '.2time-license.json'), 'utf8')
    const j = JSON.parse(raw)
    credCache = { code: j.code, domain: j.domain || '', server: j.server || envServer }
    return credCache
  } catch {
    credCache = null
    return null
  }
}

function normalizeDomain(input: string | null | undefined): string {
  if (!input) return ''
  let d = input.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').split('/')[0].split('?')[0].split(':')[0]
  return d.replace(/^www\./, '').trim()
}

export class LicenseError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'LicenseError'
  }
}

/**
 * Garante licença válida para o host atual. Lança LicenseError se inválida.
 * @param host valor de req.headers.get('host') (ou NEXTAUTH_URL como fallback)
 */
export async function assertLicense(host?: string | null): Promise<void> {
  const cred = lerCredenciais()
  if (!cred || !cred.code) {
    throw new LicenseError('Licença 2time SEO não configurada. Rode "npx 2time-seo init" com um código válido.')
  }

  const domain =
    normalizeDomain(host) ||
    normalizeDomain(process.env.NEXTAUTH_URL) ||
    normalizeDomain(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    cred.domain

  const key = `${cred.code}|${domain}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) {
    if (!hit.valid) throw new LicenseError('Licença inválida para este domínio.')
    return
  }

  try {
    const res = await fetch(`${cred.server}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cred.code, domain }),
      // não deixa o request pendurar a rota
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json().catch(() => ({ valid: false }))
    cache.set(key, { valid: !!data.valid, at: Date.now() })

    if (!data.valid) {
      throw new LicenseError(
        `Licença inválida para "${domain}". Esta instalação do 2time SEO não está autorizada neste domínio.`,
      )
    }
  } catch (e) {
    if (e instanceof LicenseError) throw e
    // Falha de rede/timeout: fail-open (não derruba o cliente por queda nossa),
    // mas não cacheia como válido — tenta de novo no próximo request.
    return
  }
}
