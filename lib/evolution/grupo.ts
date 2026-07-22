/**
 * Envio de mensagem para o GRUPO de assessoria no WhatsApp (Evolution API).
 *
 * Diferente do envio a um cliente, o destino é um JID de grupo
 * (ex.: 120363XXXXXXXXXXXX@g.us) — que NÃO pode ser normalizado como telefone.
 *
 * Config:
 *   GRUPO_ASSESSORIA_JID  → JID do grupo (obrigatório para o alerta funcionar)
 *   (usa EVOLUTION_API_URL / EVOLUTION_API_KEY / instância como o resto do módulo)
 */
import { prisma } from '@/lib/prisma'

const BASE_URL = () => process.env.EVOLUTION_API_URL ?? ''
const API_KEY = () => process.env.EVOLUTION_API_KEY ?? ''

async function getInstance(): Promise<string> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'evolution_instance' } })
    return s?.value || process.env.EVOLUTION_INSTANCE || 'forza-motos'
  } catch {
    return process.env.EVOLUTION_INSTANCE || 'forza-motos'
  }
}

/** JID do grupo: do banco (setting grupo_assessoria_jid) ou do env */
export async function getGrupoJid(): Promise<string | null> {
  try {
    const s = await prisma.setting.findUnique({ where: { key: 'grupo_assessoria_jid' } })
    return s?.value || process.env.GRUPO_ASSESSORIA_JID || null
  } catch {
    return process.env.GRUPO_ASSESSORIA_JID || null
  }
}

/**
 * Envia texto para o grupo de assessoria. Retorna false (sem lançar) quando
 * a Evolution ou o JID do grupo não estão configurados — o alerta é
 * best-effort e nunca deve derrubar o fluxo de agendamento.
 */
export async function enviarParaGrupo(mensagem: string): Promise<{ ok: boolean; erro?: string }> {
  if (!BASE_URL() || !API_KEY()) return { ok: false, erro: 'Evolution não configurada' }

  const jid = await getGrupoJid()
  if (!jid) return { ok: false, erro: 'GRUPO_ASSESSORIA_JID não configurado' }

  const instance = await getInstance()
  try {
    const res = await fetch(`${BASE_URL()}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY() },
      // Grupo: o JID vai direto em `number`, sem normalizar
      body: JSON.stringify({ number: jid, text: mensagem, delay: 800 }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.error) return { ok: false, erro: data?.error ?? `HTTP ${res.status}` }
    return { ok: true }
  } catch (e) {
    return { ok: false, erro: String(e) }
  }
}
