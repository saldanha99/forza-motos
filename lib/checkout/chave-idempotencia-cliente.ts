/**
 * Gera um UUID v4 também em WebViews que ainda não expõem crypto.randomUUID().
 * A chave identifica uma tentativa para que um clique repetido não duplique a venda.
 */
export function novaChaveIdempotenciaCliente() {
  const gerador = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (typeof gerador?.randomUUID === 'function') return gerador.randomUUID()

  const bytes = new Uint8Array(16)
  try {
    if (typeof gerador?.getRandomValues !== 'function') throw new Error('getRandomValues indisponível')
    gerador.getRandomValues(bytes)
  } catch {
    for (let indice = 0; indice < bytes.length; indice += 1) {
      bytes[indice] = Math.floor(Math.random() * 256)
    }
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
