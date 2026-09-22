import { createHmac, timingSafeEqual } from 'node:crypto'

/** Valida o X-ME-Signature oficial (HMAC-SHA256 do corpo bruto em base64). */
export function assinaturaWebhookMelhorEnvioValida(
  corpo: string,
  recebida: string,
  segredo: string,
): boolean {
  if (!recebida || !segredo) return false
  const esperada = createHmac('sha256', segredo).update(corpo).digest('base64')
  const recebidaBuffer = Buffer.from(recebida.trim())
  const esperadaBuffer = Buffer.from(esperada)
  return recebidaBuffer.length === esperadaBuffer.length && timingSafeEqual(recebidaBuffer, esperadaBuffer)
}
