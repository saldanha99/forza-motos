import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizarWhatsApp } from '@/lib/evolution/client'
import { enfileirarMensagem } from '@/lib/evolution/queue'
import { enfileirarEmail } from '@/lib/email/queue'
import { resumirPreVenda } from '@/lib/checkout/prevenda'
import { SKU_CANECA_EVENTO_PIRELLI } from '@/lib/checkout/caneca-evento-pirelli'
import { linkConfirmacaoCanecaPirelli } from '@/lib/eventos/notificacoes-caneca-pirelli'

type Db = Prisma.TransactionClient | typeof prisma

export type OutboxesPedido = { whatsappId: string | null; emailId: string | null }

/**
 * Grava as obrigações de confirmação do cliente. Quando chamada dentro da
 * transação de aprovação, pedido pago e outboxes passam a existir juntos.
 */
export async function agendarNotificacoesClientePedido(
  orderId: string,
  db: Db = prisma,
): Promise<OutboxesPedido> {
  if (process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS === 'false') {
    return { whatsappId: null, emailId: null }
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { nome: true, sku: true } } } },
      user: { select: { nome: true, telefone: true, email: true } },
      eventoPirelli: { select: { titulo: true } },
      eventoPirelliVisitante: { select: { codigoQr: true } },
    },
  })
  if (!order || !['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE'].includes(order.status)) {
    return { whatsappId: null, emailId: null }
  }

  const endereco = (order.enderecoEntrega ?? {}) as Record<string, unknown>
  // O endereço é o snapshot confirmado pelo cliente nesta compra. Ele precisa
  // prevalecer sobre dados antigos da conta (foi isso que mandou o e-mail do
  // pedido FM-2026-0024 ao endereço anterior do cadastro).
  const nomeCliente = String(endereco.nome ?? order.user?.nome ?? 'Cliente')
  const telefone = endereco.telefone ?? order.user?.telefone
  const email = endereco.email ?? order.user?.email
  const whatsappAutorizado = endereco.whatsappTransacionalAutorizado === true
  const itemCanecaEvento = order.items.find(
    (item) => item.product?.sku === SKU_CANECA_EVENTO_PIRELLI,
  )
  const compraCanecaEvento = Boolean(itemCanecaEvento)
  const resumoPreVenda = resumirPreVenda(order.items.map((item) => ({
    preVenda: item.preVendaSnapshot,
    prazoEntregaDias: item.prazoEntregaDiasSnapshot,
  })))
  const dadosPreVenda = {
    preVenda: compraCanecaEvento ? false : resumoPreVenda.preVenda,
    prazoPreVendaDias: compraCanecaEvento ? null : resumoPreVenda.prazoMaximoDias,
    prazoTotalDias: compraCanecaEvento ? null : order.fretePrazo,
    retirada: order.freteServico === 'retirada',
    nomeCampanha: order.eventoPirelli?.titulo ?? null,
    canecaEventoPirelli: compraCanecaEvento,
    nomeGravacao: compraCanecaEvento ? String(endereco.nomeGravacao ?? '') : null,
    quantidadeCanecas: itemCanecaEvento?.quantidade ?? null,
    linkConfirmacaoCaneca: compraCanecaEvento && order.eventoPirelliVisitante?.codigoQr
      ? linkConfirmacaoCanecaPirelli(order.eventoPirelliVisitante.codigoQr)
      : null,
  }
  let whatsappId: string | null = null
  let emailId: string | null = null

  if (telefone && whatsappAutorizado) {
    const whatsapp = normalizarWhatsApp(String(telefone))
    if (/^55\d{10,11}$/.test(whatsapp)) {
      const lead = await db.crmLead.findFirst({ where: { whatsapp }, select: { id: true } })
      const mensagem = await enfileirarMensagem({
        chaveIdempotencia: `pedido:${orderId}:whatsapp:confirmado`,
        whatsapp,
        nome: nomeCliente,
        tipo: 'PEDIDO_CONFIRMADO',
        leadId: lead?.id,
        userId: order.userId ?? undefined,
        payload: { numeroPedido: order.orderNumber, ...dadosPreVenda },
      }, db)
      whatsappId = mensagem.id
    }
  }

  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    const mensagem = await enfileirarEmail({
      chaveIdempotencia: `pedido:${orderId}:email:confirmado`,
      tipo: 'PEDIDO_CONFIRMADO',
      destinatario: String(email),
      payload: {
        nomeCliente,
        numeroPedido: order.orderNumber,
        itens: order.items.map((item) => ({
          nome: item.product?.nome ?? 'Produto',
          quantidade: item.quantidade,
          precoUnitario: Number(item.precoUnitario),
          preVenda: compraCanecaEvento ? false : item.preVendaSnapshot,
          prazoEntregaDias: compraCanecaEvento ? null : item.prazoEntregaDiasSnapshot,
        })),
        subtotal: Number(order.subtotal),
        frete: Number(order.frete),
        total: Number(order.total),
        freteTransportadora: order.freteTransportadora,
        fretePrazo: order.fretePrazo,
        ...dadosPreVenda,
      },
    }, db)
    emailId = mensagem.id
  }

  await db.order.update({
    where: { id: orderId },
    data: { notificacoesAgendadasEm: new Date() },
  })
  return { whatsappId, emailId }
}
