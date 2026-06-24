/**
 * Cliente Evolution API — WhatsApp automático
 *
 * Variáveis de ambiente (fallback quando não há setting no banco):
 *   EVOLUTION_API_URL     → URL base da instância
 *   EVOLUTION_API_KEY     → API Key global
 *   EVOLUTION_INSTANCE    → Nome da instância (sobrescrito pelo setting evolution_instance)
 */

import { prisma } from '@/lib/prisma'

const BASE_URL = () => process.env.EVOLUTION_API_URL ?? ''
const API_KEY  = () => process.env.EVOLUTION_API_KEY ?? ''

// Cache simples: evita query ao banco em cada mensagem enviada
let _instanceCache: { value: string; expiresAt: number } | null = null

async function getEvolutionInstance(): Promise<string> {
  const now = Date.now()
  if (_instanceCache && now < _instanceCache.expiresAt) return _instanceCache.value

  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'evolution_instance' } })
    const value = setting?.value || process.env.EVOLUTION_INSTANCE || 'forza-motos'
    _instanceCache = { value, expiresAt: now + 5 * 60 * 1000 } // TTL 5 min
    return value
  } catch {
    return process.env.EVOLUTION_INSTANCE || 'forza-motos'
  }
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

interface SendTextParams {
  whatsapp: string
  mensagem: string
  delay?: number // delay em ms antes de enviar (simula digitação)
}

interface EvolutionResponse {
  key?: { id: string }
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

  const numero = normalizarWhatsApp(params.whatsapp)
  const instance = await getEvolutionInstance()

  try {
    const res = await fetch(`${BASE_URL()}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: API_KEY(),
      },
      body: JSON.stringify({
        number: numero,
        text: params.mensagem,
        delay: params.delay ?? 1200,
      }),
    })

    const data: EvolutionResponse = await res.json()

    if (!res.ok || data.error) {
      return { ok: false, erro: data.error ?? `HTTP ${res.status}` }
    }

    return { ok: true, id: data.key?.id }
  } catch (e) {
    return { ok: false, erro: String(e) }
  }
}

/** Verifica se a instância está conectada */
export async function verificarConexao(): Promise<{ conectado: boolean; estado?: string }> {
  if (!BASE_URL() || !API_KEY()) return { conectado: false, estado: 'não configurado' }

  const instance = await getEvolutionInstance()
  try {
    const res = await fetch(`${BASE_URL()}/instance/connectionState/${instance}`, {
      headers: { apikey: API_KEY() },
    })
    const data = await res.json()
    const estado = data?.instance?.state ?? data?.state ?? 'unknown'
    return { conectado: estado === 'open', estado }
  } catch {
    return { conectado: false, estado: 'erro de conexão' }
  }
}

/** Configura webhook da Evolution para receber atualizações de mensagens */
export async function configurarWebhook(url: string): Promise<boolean> {
  if (!BASE_URL() || !API_KEY()) return false

  const instance = await getEvolutionInstance()
  try {
    const res = await fetch(`${BASE_URL()}/webhook/set/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY() },
      body: JSON.stringify({
        url,
        webhook_by_events: true,
        webhook_base64: false,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
        ],
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
