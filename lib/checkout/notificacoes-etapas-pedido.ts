import { prisma } from '@/lib/prisma'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { enfileirarEmail } from '@/lib/email/queue'
import { obterIdNotaFiscalPorPedidoOlist } from '@/lib/olist/documentos-nfe'

export type EtapaNotificacaoPedido =
  | 'NFE_AUTORIZADA'
  | 'PEDIDO_ENVIADO'
  | 'PEDIDO_ENTREGUE'

export interface OpcoesNotificacaoEtapaPedido {
  idNotaFiscal?: string | null
}

export interface ResultadoNotificacaoEtapaPedido {
  emailId: string | null
  whatsappId: string | null
  motivo?: string
}

function emailValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
}

export function resolverContatoNotificacaoPedido(
  endereco: Record<string, unknown>,
  user: { nome?: string | null; telefone?: string | null; email?: string | null } | null,
) {
  const nomeCliente = String(endereco.nome ?? user?.nome ?? 'Cliente').trim() || 'Cliente'
  const email = emailValido(endereco.email)
    ? endereco.email.trim().toLowerCase()
    : emailValido(user?.email)
      ? user.email.trim().toLowerCase()
      : null
  const telefoneCheckout = typeof endereco.telefone === 'string' && endereco.telefone.trim()
    ? endereco.telefone
    : null
  const telefoneBruto = telefoneCheckout ?? user?.telefone
  const whatsapp = telefoneBruto ? normalizarWhatsApp(String(telefoneBruto)) : null
  return {
    nomeCliente,
    email,
    whatsapp: whatsapp && /^55\d{10,11}$/.test(whatsapp) ? whatsapp : null,
  }
}

/**
 * Agenda os avisos de uma etapa logística em outboxes duráveis. As chaves
 * funcionais tornam a função segura para webhook, reconciliação e ação manual
 * concorrerem ou repetirem o mesmo evento.
 *
 * O contato informado no checkout é o snapshot daquela compra e, portanto,
 * prevalece sobre dados antigos da conta do cliente.
 */
export async function agendarNotificacoesEtapaPedido(
  orderId: string,
  etapa: EtapaNotificacaoPedido,
  opcoes: OpcoesNotificacaoEtapaPedido = {},
): Promise<ResultadoNotificacaoEtapaPedido> {
  if (process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS === 'false') {
    return { emailId: null, whatsappId: null, motivo: 'integrações desabilitadas' }
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      userId: true,
      enderecoEntrega: true,
      freteServico: true,
      freteTransportadora: true,
      fretePrazo: true,
      trackingCode: true,
      nfeChave: true,
      olistOrderId: true,
      user: { select: { nome: true, telefone: true, email: true } },
    },
  })
  if (!order) return { emailId: null, whatsappId: null, motivo: 'pedido não encontrado' }

  const endereco = (order.enderecoEntrega ?? {}) as Record<string, unknown>
  const { nomeCliente, email, whatsapp } = resolverContatoNotificacaoPedido(endereco, order.user)
  const whatsappAutorizado = endereco.whatsappTransacionalAutorizado === true

  let emailId: string | null = null
  let whatsappId: string | null = null

  if (etapa === 'NFE_AUTORIZADA') {
    if (!order.nfeChave) {
      return { emailId, whatsappId, motivo: 'NF-e ainda não registrada' }
    }
    if (!email) return { emailId, whatsappId, motivo: 'pedido sem e-mail válido' }

    const chaveIdempotencia = `pedido:${order.id}:email:nfe:${order.nfeChave}`
    const existente = await prisma.emailOutbox.findUnique({
      where: { chaveIdempotencia },
      select: { id: true },
    })
    if (existente) return { emailId: existente.id, whatsappId }

    let idNotaFiscal = opcoes.idNotaFiscal?.trim() || null
    if (!idNotaFiscal && order.olistOrderId) {
      try {
        idNotaFiscal = await obterIdNotaFiscalPorPedidoOlist(order.olistOrderId)
      } catch (error) {
        console.error(
          `[notificacoes-pedido] NF-e ${order.orderNumber}: documento da Olist ainda indisponível —`,
          error instanceof Error ? error.message : 'falha desconhecida',
        )
        return { emailId, whatsappId, motivo: 'documento fiscal ainda indisponível' }
      }
      // Para pedidos replicados na Olist, só enviamos quando for possível
      // entregar o documento, não apenas uma chave sem o DANFE/XML.
      if (!idNotaFiscal) {
        return { emailId, whatsappId, motivo: 'documento fiscal ainda indisponível' }
      }
    }

    const mensagem = await enfileirarEmail({
      chaveIdempotencia,
      tipo: 'NFE_AUTORIZADA',
      destinatario: email,
      payload: {
        nomeCliente,
        numeroPedido: order.orderNumber,
        chaveNfe: order.nfeChave,
        idNotaFiscal,
      },
    })
    return { emailId: mensagem.id, whatsappId }
  }

  const retirada = order.freteServico === 'retirada'
  if (retirada) {
    // A retirada possui textos próprios e continua sendo tratada pelo fluxo
    // do balcão; não deve dizer ao cliente que houve transporte/entrega.
    return { emailId, whatsappId, motivo: 'pedido para retirada' }
  }

  if (etapa === 'PEDIDO_ENVIADO') {
    if (!['ENVIADO', 'ENTREGUE'].includes(order.status)) {
      return { emailId, whatsappId, motivo: 'pedido ainda não enviado' }
    }
    if (!order.trackingCode) {
      return { emailId, whatsappId, motivo: 'rastreio ainda indisponível' }
    }
    const payload = {
      nomeCliente,
      numeroPedido: order.orderNumber,
      rastreio: order.trackingCode,
      transportadora: order.freteTransportadora ?? 'Transportadora',
      prazo: order.fretePrazo,
    }
    if (email) {
      const mensagem = await enfileirarEmail({
        chaveIdempotencia: `pedido:${order.id}:email:enviado`,
        tipo: 'PEDIDO_ENVIADO',
        destinatario: email,
        payload,
      })
      emailId = mensagem.id
    }
    if (whatsapp && whatsappAutorizado) {
      const lead = await prisma.crmLead.findFirst({ where: { whatsapp }, select: { id: true } })
      const mensagem = await enfileirarMensagem({
        chaveIdempotencia: `pedido:${order.id}:whatsapp:enviado`,
        whatsapp,
        nome: nomeCliente,
        tipo: 'PEDIDO_ENVIADO',
        leadId: lead?.id,
        userId: order.userId ?? undefined,
        payload: {
          numeroPedido: order.orderNumber,
          rastreio: order.trackingCode,
          transportadora: order.freteTransportadora ?? 'Transportadora',
        },
      })
      whatsappId = mensagem.id
    }
    return { emailId, whatsappId }
  }

  if (order.status !== 'ENTREGUE') {
    return { emailId, whatsappId, motivo: 'entrega ainda não confirmada' }
  }
  const payloadEntrega = {
    nomeCliente,
    numeroPedido: order.orderNumber,
    rastreio: order.trackingCode,
    transportadora: order.freteTransportadora,
  }
  if (email) {
    const mensagem = await enfileirarEmail({
      chaveIdempotencia: `pedido:${order.id}:email:entregue`,
      tipo: 'PEDIDO_ENTREGUE',
      destinatario: email,
      payload: payloadEntrega,
    })
    emailId = mensagem.id
  }
  if (whatsapp && whatsappAutorizado) {
    const lead = await prisma.crmLead.findFirst({ where: { whatsapp }, select: { id: true } })
    const mensagem = await enfileirarMensagem({
      chaveIdempotencia: `pedido:${order.id}:whatsapp:entregue`,
      whatsapp,
      nome: nomeCliente,
      tipo: 'PEDIDO_ENTREGUE',
      leadId: lead?.id,
      userId: order.userId ?? undefined,
      payload: { numeroPedido: order.orderNumber },
    })
    whatsappId = mensagem.id
  }
  return { emailId, whatsappId }
}

export interface ResumoReparoNotificacoesEtapas {
  analisados: number
  nfe: number
  enviados: number
  entregues: number
  falhas: number
}

/**
 * Rede de segurança contra webhooks perdidos ou falha entre a mudança de
 * status e a criação da outbox. A janela curta evita avisar pedidos históricos
 * quando a funcionalidade é implantada pela primeira vez.
 */
export async function repararNotificacoesEtapasPedidos(
  limite = 30,
): Promise<ResumoReparoNotificacoesEtapas> {
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60_000)
  const pedidos = await prisma.order.findMany({
    where: {
      status: { not: 'CANCELADO' },
      OR: [
        { nfeChave: { not: null }, nfeRegistradaEm: { gte: desde } },
        { status: { in: ['ENVIADO', 'ENTREGUE'] }, updatedAt: { gte: desde } },
      ],
    },
    select: { id: true, status: true, nfeChave: true },
    orderBy: { updatedAt: 'desc' },
    take: Math.max(1, Math.min(limite, 50)),
  })

  const resumo: ResumoReparoNotificacoesEtapas = {
    analisados: pedidos.length,
    nfe: 0,
    enviados: 0,
    entregues: 0,
    falhas: 0,
  }

  for (const pedido of pedidos) {
    try {
      if (pedido.nfeChave) {
        const resultado = await agendarNotificacoesEtapaPedido(pedido.id, 'NFE_AUTORIZADA')
        if (resultado.emailId) resumo.nfe += 1
      }
      // Se a reconciliação só voltou quando já estava entregue, não mandamos
      // um aviso de postagem atrasado junto com o de entrega.
      if (pedido.status === 'ENVIADO') {
        const resultado = await agendarNotificacoesEtapaPedido(pedido.id, 'PEDIDO_ENVIADO')
        if (resultado.emailId || resultado.whatsappId) resumo.enviados += 1
      } else if (pedido.status === 'ENTREGUE') {
        const resultado = await agendarNotificacoesEtapaPedido(pedido.id, 'PEDIDO_ENTREGUE')
        if (resultado.emailId || resultado.whatsappId) resumo.entregues += 1
      }
    } catch (error) {
      resumo.falhas += 1
      console.error(
        '[notificacoes-pedido] falha ao reparar etapa:',
        error instanceof Error ? error.message : 'falha desconhecida',
      )
    }
  }
  return resumo
}
