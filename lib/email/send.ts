import { getResend, EMAIL_FROM } from './client'
import {
  htmlCodigoRecuperacaoEventoPirelli,
  htmlNfeAutorizada,
  htmlPedidoConfirmado,
  htmlPedidoEntregue,
  htmlPedidoEnviado,
  htmlIngressoConfirmado,
  htmlPedidoProntoRetirada,
} from './templates'

type OpcoesIdempotencia = { idempotencyKey?: string }

export async function enviarEmailConfirmacao(opts: {
  para: string
  nomeCliente: string
  numeroPedido: string
  itens: Array<{
    nome: string
    quantidade: number
    precoUnitario: number | string
    preVenda?: boolean
    prazoEntregaDias?: number | null
  }>
  subtotal: number
  frete: number
  total: number
  freteTransportadora?: string | null
  fretePrazo?: number | null
  preVenda?: boolean
  prazoPreVendaDias?: number | null
  prazoTotalDias?: number | null
  retirada?: boolean
  nomeCampanha?: string | null
  canecaEventoPirelli?: boolean
  nomeGravacao?: string | null
  quantidadeCanecas?: number | null
  linkConfirmacaoCaneca?: string | null
}, requestOptions: OpcoesIdempotencia = {}): Promise<{ enviado: boolean; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return { enviado: false }
  }

  const { data, error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: opts.canecaEventoPirelli
      ? `☕ Caneca confirmada — pedido ${opts.numeroPedido}`
      : `✅ Pedido ${opts.numeroPedido} confirmado — Forza Motos`,
    html: htmlPedidoConfirmado(opts),
  }, requestOptions)

  if (error) {
    console.error('[email] Falha ao enviar confirmação:', error)
    return { enviado: false }
  } else {
    console.log(`[email] Confirmação enviada para ${opts.para} (pedido ${opts.numeroPedido})`)
    return { enviado: true, id: data?.id }
  }
}

export async function enviarEmailRastreio(opts: {
  para: string
  nomeCliente: string
  numeroPedido: string
  rastreio: string
  transportadora: string
  prazo?: number | null
}, requestOptions: OpcoesIdempotencia = {}): Promise<{ enviado: boolean; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return { enviado: false }
  }

  const { data, error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: `🚚 Seu pedido ${opts.numeroPedido} foi enviado — Forza Motos`,
    html: htmlPedidoEnviado(opts),
  }, requestOptions)

  if (error) {
    console.error('[email] Falha ao enviar rastreio:', error)
    return { enviado: false }
  } else {
    console.log(`[email] Rastreio enviado para ${opts.para} (pedido ${opts.numeroPedido})`)
    return { enviado: true, id: data?.id }
  }
}

export async function enviarEmailNfeAutorizada(opts: {
  para: string
  nomeCliente: string
  numeroPedido: string
  chaveNfe: string
  danfeUrl?: string | null
  xmlNfe?: string | null
}, requestOptions: OpcoesIdempotencia = {}): Promise<{ enviado: boolean; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — NF-e não enviada')
    return { enviado: false }
  }

  const nomeArquivo = opts.numeroPedido
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'pedido'
  const attachments = opts.xmlNfe
    ? [{
        content: Buffer.from(opts.xmlNfe, 'utf8'),
        filename: `NFe-${nomeArquivo}.xml`,
        contentType: 'application/xml',
      }]
    : undefined

  const { data, error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: `🧾 Nota fiscal do pedido ${opts.numeroPedido} — Forza Motos`,
    html: htmlNfeAutorizada({
      ...opts,
      xmlAnexado: Boolean(opts.xmlNfe),
    }),
    attachments,
  }, requestOptions)

  if (error) {
    console.error('[email] Falha ao enviar NF-e:', error)
    return { enviado: false }
  }
  console.log(`[email] NF-e enviada para ${opts.para} (pedido ${opts.numeroPedido})`)
  return { enviado: true, id: data?.id }
}

export async function enviarEmailEntrega(opts: {
  para: string
  nomeCliente: string
  numeroPedido: string
  rastreio?: string | null
  transportadora?: string | null
}, requestOptions: OpcoesIdempotencia = {}): Promise<{ enviado: boolean; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — entrega não enviada')
    return { enviado: false }
  }

  const { data, error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: `📦 Pedido ${opts.numeroPedido} entregue — Forza Motos`,
    html: htmlPedidoEntregue(opts),
  }, requestOptions)

  if (error) {
    console.error('[email] Falha ao enviar confirmação de entrega:', error)
    return { enviado: false }
  }
  console.log(`[email] Entrega enviada para ${opts.para} (pedido ${opts.numeroPedido})`)
  return { enviado: true, id: data?.id }
}

export async function enviarEmailIngresso(opts: {
  para: string
  nomeCliente: string
  tituloEvento: string
  dataEvento: string
  localEvento: string
  quantidade: number
  total: number
}, requestOptions: OpcoesIdempotencia = {}): Promise<{ enviado: boolean; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return { enviado: false }
  }

  const { data, error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: `🎟️ Ingresso confirmado — ${opts.tituloEvento}`,
    html: htmlIngressoConfirmado(opts),
  }, requestOptions)

  if (error) {
    console.error('[email] Falha ao enviar ingresso:', error)
    return { enviado: false }
  } else {
    console.log(`[email] Ingresso enviado para ${opts.para} (${opts.tituloEvento})`)
    return { enviado: true, id: data?.id }
  }
}

export async function enviarEmailProntoRetirada(opts: {
  para: string
  nomeCliente: string
  numeroPedido: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — e-mail não enviado')
    return
  }

  const { error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: `🏁 Seu pedido ${opts.numeroPedido} está pronto para retirada! — Forza Motos`,
    html: htmlPedidoProntoRetirada(opts),
  })

  if (error) {
    console.error('[email] Falha ao enviar pronto para retirada:', error)
  } else {
    console.log(`[email] E-mail de retirada pronto enviado para ${opts.para} (pedido ${opts.numeroPedido})`)
  }
}

export async function enviarEmailRecuperacaoEventoPirelli(
  opts: { para: string; codigo: string },
  requestOptions: OpcoesIdempotencia = {},
): Promise<{ enviado: boolean; id?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY não configurada — código de recuperação não enviado')
    return { enviado: false }
  }

  const { data, error } = await getResend().emails.send({
    from: EMAIL_FROM(),
    to: opts.para,
    subject: 'Seu código de acesso — Evento Pirelli | Forza Motos',
    html: htmlCodigoRecuperacaoEventoPirelli(opts.codigo),
  }, requestOptions)

  if (error) {
    // Não registrar o objeto do provedor: ele pode conter o destinatário.
    console.error('[email] Provedor não confirmou o código de recuperação do Evento Pirelli')
    return { enviado: false }
  }
  console.log('[email] Código de recuperação do Evento Pirelli enviado')
  return { enviado: true, id: data?.id }
}
