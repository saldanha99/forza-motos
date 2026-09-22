import { timingSafeEqual } from 'node:crypto'

export function normalizarVerificacaoRastreio(valor: unknown): string {
  const texto = String(valor ?? '').trim()
  if (texto.includes('@')) return texto.toLocaleLowerCase('pt-BR')
  return texto.replace(/\D/g, '')
}

function iguaisEmTempoConstante(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
}

export function verificacaoRastreioConfere(candidatos: unknown[], verificacao: unknown): boolean {
  const normalizada = normalizarVerificacaoRastreio(verificacao)
  if (!normalizada) return false
  return candidatos
    .map(normalizarVerificacaoRastreio)
    .filter(Boolean)
    .some((candidato) => iguaisEmTempoConstante(candidato, normalizada))
}

export interface PedidoParaRastreio {
  orderNumber: string
  status: string
  createdAt: Date | string
  freteServico: string | null
  freteTransportadora: string | null
  fretePrazo: number | null
  trackingCode: string | null
  tracking: Array<{ status: string; descricao: string; createdAt: Date | string }>
}

/** Lista positiva: nenhum campo pessoal/financeiro entra por acidente. */
export function respostaMinimaRastreio(pedido: PedidoParaRastreio) {
  return {
    orderNumber: pedido.orderNumber,
    status: pedido.status,
    createdAt: pedido.createdAt,
    freteServico: pedido.freteServico,
    freteTransportadora: pedido.freteTransportadora,
    fretePrazo: pedido.fretePrazo,
    trackingCode: pedido.trackingCode,
    tracking: pedido.tracking,
  }
}
