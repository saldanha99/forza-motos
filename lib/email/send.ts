import { getResend, EMAIL_FROM } from './client'
import { htmlPedidoConfirmado, htmlPedidoEnviado, htmlIngressoConfirmado } from './templates'

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

  const { error } = await getResend().emails.send({
    from: EMAIL_FROM(),
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

  const { error } = await getResend().emails.send({
    from: EMAIL_FROM(),
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

export async function enviarEmailIngresso(opts: {
  para: string
  nomeCliente: string
  tituloEvento: string
  dataEvento: string
  localEvento: string
  quantidade: number
  total: number
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return
  }

  const { error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: `🎟️ Ingresso confirmado — ${opts.tituloEvento}`,
    html: htmlIngressoConfirmado(opts),
  })

  if (error) {
    console.error('[email] Falha ao enviar ingresso:', error)
  } else {
    console.log(`[email] Ingresso enviado para ${opts.para} (${opts.tituloEvento})`)
  }
}
