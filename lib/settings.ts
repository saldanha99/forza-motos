/**
 * Settings — configurações editáveis pelo painel admin (chave/valor no banco).
 * Permite alterar token do GSC, nome do site, etc. sem precisar de redeploy.
 */
import { prisma } from '@/lib/prisma'

export const SETTINGS_KEYS = {
  GOOGLE_VERIFICATION: 'google_site_verification',
  SITE_NAME:           'site_name',
  SITE_URL:            'site_url',
  INDEXNOW_KEY:        'indexnow_key',
  MP_CHECKOUT_PRO_ENABLED: 'mp_checkout_pro_enabled',
  MP_ACCEPT_CARDS:     'mp_accept_cards',
  MP_ACCEPT_TICKET:    'mp_accept_ticket',
  MP_ACCEPT_PIX:       'mp_accept_pix',
  MP_MAX_INSTALLMENTS: 'mp_max_installments',
  MP_AUTO_RETURN:      'mp_auto_return',
  MP_BINARY_MODE:      'mp_binary_mode',
  MP_PREFERENCE_EXPIRATION_MINUTES: 'mp_preference_expiration_minutes',
} as const

export async function getSetting(key: string): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } })
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  try {
    const rows = await prisma.setting.findMany({ where: { key: { in: keys } } })
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  } catch {
    return {}
  }
}

export async function setSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where:  { key },
    create: { key, value },
    update: { value },
  })
}
