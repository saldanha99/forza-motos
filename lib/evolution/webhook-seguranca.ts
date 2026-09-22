export type StatusConfirmadoWhatsApp = 'ENTREGUE' | 'LIDA'

/** PENDING e SERVER_ACK não confirmam entrega; somente ACKs do WhatsApp. */
export function statusConfirmadoEvolution(update: any): StatusConfirmadoWhatsApp | null {
  const bruto = update?.update?.status ?? update?.status ?? update?.data?.status
  if (typeof bruto === 'number' || /^\d+$/.test(String(bruto ?? ''))) {
    const ack = Number(bruto)
    if (ack === 3) return 'ENTREGUE'
    if (ack === 4 || ack === 5) return 'LIDA'
    return null
  }

  const status = String(bruto ?? '').trim().toUpperCase()
  if (['READ', 'READ_ACK', 'PLAYED'].includes(status)) return 'LIDA'
  if (['DELIVERY_ACK', 'DELIVERED'].includes(status)) return 'ENTREGUE'
  return null
}

export function solicitouOptOutWhatsapp(texto: string): boolean {
  const normalizado = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return [
    'PARE',
    'SAIR',
    'STOP',
    'CANCELAR',
    'NAO QUERO MAIS',
    'PARAR MENSAGENS',
  ].includes(normalizado)
}
