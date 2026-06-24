import { resend, EMAIL_FROM } from './client'
import { htmlPedidoConfirmado, htmlPedidoEnviado } from './templates'

export async function enviarEmailConfirmacao(opts: {
  para: string
  nomeCliente: string
  numeroPedido: string
  itens: Array<{ nome: string; quantidade: number; precoUnitario: number | string }>
  subtotal: number
  frete: number
  total: number
  freteTransportadora?: string | null
  fretePrazo?: number | null
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: opts.para,
    subject: `✅ Pedido ${opts.numeroPedido} confirmado — Forza Motos`,
    html: htmlPedidoConfirmado(opts),
  })

  if (error) {
    console.error('[email] Falha ao enviar confirmação:', error)
  } else {
    console.log(`[email] Confirmação enviada para ${opts.para} (pedido ${opts.numeroPedido})`)
  }
}

export async function enviarEmailRastreio(opts: {
  para: string
  nomeCliente: string
  numeroPedido: string
  rastreio: string
  transportadora: string
  prazo?: number | null
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: opts.para,
    subject: `🚚 Seu pedido ${opts.numeroPedido} foi enviado — Forza Motos`,
    html: htmlPedidoEnviado(opts),
  })

  if (error) {
    console.error('[email] Falha ao enviar rastreio:', error)
  } else {
    console.log(`[email] Rastreio enviado para ${opts.para} (pedido ${opts.numeroPedido})`)
  }
}
