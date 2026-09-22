/**
 * Cliente Evolution API — WhatsApp automático
 *
 * Variáveis de ambiente (fallback quando não há setting no banco):
 *   EVOLUTION_API_URL     → URL base da instância
 *   EVOLUTION_API_KEY     → API Key global
 *   EVOLUTION_INSTANCE    → Nome da instância (sobrescrito pelo setting evolution_instance)
 */

import { getInstanciaAtiva } from './instancia'

const BASE_URL = () => process.env.EVOLUTION_API_URL ?? ''
const API_KEY  = () => process.env.EVOLUTION_API_KEY ?? ''
const WEBHOOK_SECRET = () => process.env.EVOLUTION_WEBHOOK_SECRET?.trim() ?? ''

const EVENTOS_WEBHOOK = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
] as const

let webhookVerificado: { instance: string; url: string; expiresAt: number } | null = null

function inteiroConfigurado(
  valor: string | undefined,
  padrao: number,
  minimo: number,
  maximo: number,
): number {
  const numero = Number.parseInt(valor ?? '', 10)
  if (!Number.isFinite(numero)) return padrao
  return Math.max(minimo, Math.min(maximo, numero))
}

function apiUrl(caminho: string): string {
  return `${BASE_URL().replace(/\/$/, '')}${caminho}`
}

function headersEvolution(): Record<string, string> {
  return { 'Content-Type': 'application/json', apikey: API_KEY() }
}


/** Normaliza número para formato WhatsApp: 5519999999999 */
export function normalizarWhatsApp(tel: string): string {
  // Remove tudo que não for dígito
  let num = tel.replace(/\D/g, '')
  // Adiciona DDI Brasil se não tiver
  if (num.length === 11) num = `55${num}`
  if (num.length === 10) num = `55${num}`
  return num
}

/**
 * O mesmo campo `number` da Evolution recebe telefone ou JID de grupo. Não
 * remova `@g.us`: sem esse sufixo o destino vira um número comum inválido.
 */
export function normalizarDestinoWhatsApp(destino: string): string {
  const valor = destino.trim()
  if (/^[\d-]+@g\.us$/.test(valor)) return valor
  return normalizarWhatsApp(valor)
}

interface SendTextParams {
  whatsapp: string
  mensagem: string
  delay?: number // delay em ms antes de enviar (simula digitação)
}

interface EvolutionResponse {
  key?: { id: string }
  data?: { key?: { id?: string }; id?: string }
  id?: string
  messageId?: string
  message?: unknown
  messageTimestamp?: number
  status?: string
  error?: string
}

/** Envia mensagem de texto via Evolution API */
export async function enviarMensagem(params: SendTextParams): Promise<{ ok: boolean; id?: string; erro?: string }> {
  if (!BASE_URL() || !API_KEY()) {
    console.warn('[Evolution] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados')
    return { ok: false, erro: 'Evolution API não configurada' }
  }

  const numero = normalizarDestinoWhatsApp(params.whatsapp)
  const instance = await getInstanciaAtiva()

  try {
    const timeoutMs = inteiroConfigurado(
      process.env.EVOLUTION_SEND_TIMEOUT_MS,
      10_000,
      3_000,
      20_000,
    )
    const res = await fetch(apiUrl(`/message/sendText/${encodeURIComponent(instance)}`), {
      method: 'POST',
      // Menor que a lease da outbox: um worker nunca fica preso até outro
      // retomar a mesma mensagem e enviá-la em paralelo.
      signal: AbortSignal.timeout(timeoutMs),
      headers: headersEvolution(),
      body: JSON.stringify({
        number: numero,
        text: params.mensagem,
        delay: params.delay ?? 1200,
      }),
    })

    const data: EvolutionResponse = await res.json().catch(() => ({}))

    if (!res.ok || data.error) {
      return { ok: false, erro: data.error ?? `HTTP ${res.status}` }
    }

    const id = data.key?.id ?? data.data?.key?.id ?? data.data?.id ?? data.messageId ?? data.id
    if (!id) {
      // Um 2xx apenas diz que a API aceitou a requisição HTTP. Sem o ID da
      // mensagem não há como correlacionar DELIVERY_ACK/READ no webhook.
      return { ok: false, erro: 'Evolution aceitou a requisição sem retornar o ID da mensagem' }
    }

    // `ok` significa aceita pela Evolution, nunca entregue no WhatsApp. A
    // entrega só é confirmada posteriormente pelo webhook.
    return { ok: true, id }
  } catch (e) {
    return { ok: false, erro: String(e) }
  }
}

/** Verifica se a instância está conectada */
export async function verificarConexao(): Promise<{ conectado: boolean; estado?: string }> {
  if (!BASE_URL() || !API_KEY()) return { conectado: false, estado: 'não configurado' }

  const instance = await getInstanciaAtiva()
  try {
    const res = await fetch(apiUrl(`/instance/connectionState/${encodeURIComponent(instance)}`), {
      signal: AbortSignal.timeout(8_000),
      headers: { apikey: API_KEY() },
    })
    const data = await res.json()
    const estado = data?.instance?.state ?? data?.state ?? 'unknown'
    return { conectado: estado === 'open', estado }
  } catch {
    return { conectado: false, estado: 'erro de conexão' }
  }
}

/** Monta a URL pública única do webhook, sem sufixo por evento. */
export function obterUrlWebhookEvolution(): string | null {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL
  if (!base) return null
  try {
    const url = new URL('/api/evolution/webhook', base)
    if (
      process.env.NODE_ENV === 'production'
      && ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    ) return null
    return url.toString()
  } catch {
    return null
  }
}

function configuracaoWebhookAtual(data: any) {
  const webhook = data?.webhook ?? data ?? {}
  return {
    enabled: webhook.enabled === true,
    url: String(webhook.url ?? ''),
    byEvents: webhook.byEvents ?? webhook.webhookByEvents ?? false,
    headers: webhook.headers && typeof webhook.headers === 'object'
      ? webhook.headers as Record<string, string>
      : {},
    events: Array.isArray(webhook.events) ? webhook.events.map(String) : [],
  }
}

/** Configura webhook da Evolution para receber atualizações de mensagens. */
export async function configurarWebhook(url: string): Promise<boolean> {
  if (!BASE_URL() || !API_KEY()) return false
  if (process.env.NODE_ENV === 'production' && !WEBHOOK_SECRET()) {
    console.error('[Evolution] EVOLUTION_WEBHOOK_SECRET não configurado; webhook bloqueado')
    return false
  }

  const instance = await getInstanciaAtiva()
  const headers = WEBHOOK_SECRET()
    ? { 'x-forza-webhook-secret': WEBHOOK_SECRET() }
    : undefined
  const webhookAtual = {
    enabled: true,
    url,
    byEvents: false,
    base64: false,
    ...(headers ? { headers } : {}),
    events: [...EVENTOS_WEBHOOK],
  }

  // Evolution v2 atual exige o envelope `webhook` e os nomes byEvents/base64.
  // O segundo formato mantém compatibilidade com versões v2 anteriores.
  const corpos = [
    { webhook: webhookAtual },
    {
      webhook: {
        ...webhookAtual,
        webhookByEvents: false,
        webhookBase64: false,
      },
    },
  ]
  try {
    for (const corpo of corpos) {
      const res = await fetch(apiUrl(`/webhook/set/${encodeURIComponent(instance)}`), {
        method: 'POST',
        signal: AbortSignal.timeout(8_000),
        headers: headersEvolution(),
        body: JSON.stringify(corpo),
      })
      if (res.ok) {
        webhookVerificado = { instance, url, expiresAt: Date.now() + 10 * 60_000 }
        return true
      }
      // 401/403 não mudam com outro formato; evita repetir credenciais ruins.
      if (res.status === 401 || res.status === 403) return false
    }
    return false
  } catch (error) {
    console.error(
      '[Evolution] Não foi possível configurar o webhook:',
      error instanceof Error ? error.message : 'falha desconhecida',
    )
    return false
  }
}

/**
 * Confere a instância ativa e repara configurações antigas (especialmente
 * webhookByEvents=true, que anexava um caminho não atendido pela aplicação).
 */
export async function garantirWebhookEvolution(
  url = obterUrlWebhookEvolution(),
): Promise<boolean> {
  if (!url || !BASE_URL() || !API_KEY()) return false
  if (process.env.NODE_ENV === 'production' && !WEBHOOK_SECRET()) return false

  const instance = await getInstanciaAtiva()
  if (
    webhookVerificado
    && webhookVerificado.instance === instance
    && webhookVerificado.url === url
    && webhookVerificado.expiresAt > Date.now()
  ) return true

  try {
    const res = await fetch(apiUrl(`/webhook/find/${encodeURIComponent(instance)}`), {
      signal: AbortSignal.timeout(8_000),
      headers: { apikey: API_KEY() },
      cache: 'no-store',
    })
    if (res.ok) {
      const atual = configuracaoWebhookAtual(await res.json().catch(() => ({})))
      const eventosPresentes = EVENTOS_WEBHOOK.every((evento) => atual.events.includes(evento))
      const segredoPresente = !WEBHOOK_SECRET()
        || atual.headers['x-forza-webhook-secret'] === WEBHOOK_SECRET()
      if (
        atual.enabled
        && atual.url === url
        && atual.byEvents === false
        && eventosPresentes
        && segredoPresente
      ) {
        webhookVerificado = { instance, url, expiresAt: Date.now() + 10 * 60_000 }
        return true
      }
    }
  } catch {
    // A configuração abaixo ainda pode funcionar mesmo se o GET falhar.
  }

  return configurarWebhook(url)
}
