export type EnvioStatus = 'CARRINHO' | 'COMPRA_INCERTA' | 'COMPRADA' | 'GERADA' | 'CANCELADA'

export type PedidoStatusLogistico = 'ENVIADO' | 'ENTREGUE'

const STATUS_COMPRADOS = new Set([
  'released', 'paid', 'generated', 'posted', 'received', 'delivered',
  'undelivered', 'paused', 'suspended',
])

const STATUS_GERADOS = new Set([
  'generated', 'posted', 'received', 'delivered', 'undelivered', 'paused', 'suspended',
])

/**
 * Estados que só existem depois que a encomenda foi entregue à malha logística.
 * Mesmo que o evento `order.posted` tenha se perdido, esses estados permitem
 * convergir o pedido local sem regredir uma entrega já confirmada.
 */
const STATUS_POSTADOS = new Set([
  'posted', 'received', 'undelivered', 'paused', 'suspended',
])

type DadosEnvioRemoto = Record<string, unknown>

function comoRegistro(valor: unknown): DadosEnvioRemoto | null {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as DadosEnvioRemoto
    : null
}

function dadosDoEnvio(resposta: unknown): DadosEnvioRemoto {
  const raiz = comoRegistro(resposta)
  return comoRegistro(raiz?.data) ?? raiz ?? {}
}

export function analisarEstadoEnvioRemoto(resposta: unknown): {
  status: string
  comprada: boolean
  gerada: boolean
  cancelada: boolean
} {
  const dados = dadosDoEnvio(resposta)
  const status = String(dados?.status ?? '').trim().toLowerCase()
  const cancelada = Boolean(dados?.canceled_at) || status === 'cancelled' || status === 'canceled'
  const gerada = !cancelada && (Boolean(dados?.generated_at) || STATUS_GERADOS.has(status))
  const comprada = !cancelada && (gerada || Boolean(dados?.paid_at) || STATUS_COMPRADOS.has(status))
  return { status, comprada, gerada, cancelada }
}

/**
 * Traduz o ciclo da etiqueta do Melhor Envio para o status operacional da loja.
 * Aceita tanto a resposta de `GET /me/orders/:id` quanto o corpo/data do webhook.
 */
export function statusPedidoDoEnvioRemoto(
  resposta: unknown,
  evento: unknown = '',
): PedidoStatusLogistico | null {
  const dados = dadosDoEnvio(resposta)
  const status = String(dados?.status ?? '').trim().toLowerCase()
  const eventoNormalizado = String(evento ?? '').trim().toLowerCase()

  if (
    eventoNormalizado === 'order.cancelled' ||
    eventoNormalizado === 'cancelled' ||
    eventoNormalizado === 'canceled' ||
    status === 'cancelled' ||
    status === 'canceled' ||
    Boolean(dados?.canceled_at)
  ) {
    return null
  }

  if (
    eventoNormalizado === 'order.delivered' ||
    eventoNormalizado === 'delivered' ||
    status === 'delivered' ||
    Boolean(dados?.delivered_at)
  ) {
    return 'ENTREGUE'
  }

  if (
    eventoNormalizado === 'order.posted' ||
    eventoNormalizado === 'posted' ||
    STATUS_POSTADOS.has(status) ||
    Boolean(dados?.posted_at)
  ) {
    return 'ENVIADO'
  }

  return null
}
