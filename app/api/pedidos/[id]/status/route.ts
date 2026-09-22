import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cancelarPedidoComCompensacao } from '@/lib/checkout/reserva'
import {
  cancelarPedidoPagoAdministrativamente,
  processarReembolso,
} from '@/lib/checkout/pagamento'
import { consultarEnvioME } from '@/lib/frete/melhor-envio'
import { analisarEstadoEnvioRemoto } from '@/lib/frete/estado-envio'
import { agendarNotificacoesEtapaPedido } from '@/lib/checkout/notificacoes-etapas-pedido'

const STATUS_VALIDOS = [
  'AGUARDANDO_PAGAMENTO',
  'CONFIRMADO',
  'SEPARANDO',
  'ENVIADO',
  'ENTREGUE',
  'CANCELADO',
] as const
type StatusPedido = (typeof STATUS_VALIDOS)[number]

const TRANSICOES: Record<StatusPedido, readonly StatusPedido[]> = {
  AGUARDANDO_PAGAMENTO: ['CANCELADO'],
  CONFIRMADO: ['SEPARANDO', 'ENVIADO', 'CANCELADO'],
  SEPARANDO: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
}

const DESCRICOES: Partial<Record<StatusPedido, string>> = {
  CONFIRMADO: 'Pagamento confirmado — pedido em processamento.',
  SEPARANDO: 'Pedido sendo separado no estoque.',
  ENVIADO: 'Pedido enviado para a transportadora.',
  ENTREGUE: 'Pedido entregue ao destinatário.',
  CANCELADO: 'Pedido cancelado.',
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const status = body?.status as StatusPedido
  if (!STATUS_VALIDOS.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }

  const currentOrder = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      status: true,
      freteServico: true,
      orderNumber: true,
      userId: true,
      enderecoEntrega: true,
      olistOrderId: true,
      olistSyncStatus: true,
      melhorEnvioId: true,
      melhorEnvioStatus: true,
      user: { select: { nome: true, telefone: true, email: true } },
    },
  })
  if (!currentOrder) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  if (currentOrder.status === status) {
    const pedido = await prisma.order.findUniqueOrThrow({ where: { id: params.id } })
    return NextResponse.json(pedido)
  }

  const atual = currentOrder.status as StatusPedido
  if (!TRANSICOES[atual]?.includes(status)) {
    const detalhe = status === 'CONFIRMADO' && atual === 'AGUARDANDO_PAGAMENTO'
      ? 'A confirmação de pagamento só pode vir do webhook validado do Mercado Pago.'
      : `Transição insegura: ${atual} → ${status}.`
    return NextResponse.json({ error: detalhe }, { status: 409 })
  }

  const isRetirada = currentOrder.freteServico === 'retirada'
  let descricao = DESCRICOES[status] ?? `Status atualizado para ${status}`
  if (isRetirada && status === 'ENVIADO') descricao = 'Pedido disponível para retirada no balcão.'
  if (isRetirada && status === 'ENTREGUE') descricao = 'Pedido retirado no balcão.'

  if (status === 'CANCELADO' && atual === 'AGUARDANDO_PAGAMENTO') {
    const compensado = await cancelarPedidoComCompensacao(
      params.id,
      `${descricao} Cancelado no painel administrativo — reserva e cupom devolvidos.`,
    )
    if (!compensado) {
      return NextResponse.json(
        { error: 'O pedido mudou de estado durante o cancelamento. Recarregue e tente novamente.' },
        { status: 409 },
      )
    }
    return NextResponse.json(await prisma.order.findUniqueOrThrow({ where: { id: params.id } }))
  }

  if (status === 'CANCELADO') {
    let statusEnvio = currentOrder.melhorEnvioStatus
    if (
      currentOrder.melhorEnvioId &&
      ['COMPRA_INCERTA', 'COMPRADA', 'GERADA'].includes(statusEnvio ?? '')
    ) {
      try {
        const remoto = analisarEstadoEnvioRemoto(
          await consultarEnvioME(currentOrder.melhorEnvioId),
        )
        if (remoto.cancelada) {
          await prisma.$transaction(async (tx) => {
            const atualizou = await tx.order.updateMany({
              where: { id: params.id, melhorEnvioStatus: { not: 'CANCELADA' } },
              data: { melhorEnvioStatus: 'CANCELADA' },
            })
            if (atualizou.count) {
              await tx.orderTracking.create({
                data: {
                  orderId: params.id,
                  status: atual,
                  descricao: 'Cancelamento da etiqueta confirmado no Melhor Envio antes do estorno do pedido.',
                },
              })
            }
          })
          statusEnvio = 'CANCELADA'
        }
      } catch {
        return NextResponse.json(
          { error: 'Não foi possível confirmar o cancelamento da etiqueta no Melhor Envio. Tente novamente antes de estornar.' },
          { status: 409 },
        )
      }
    }

    if (['COMPRA_INCERTA', 'COMPRADA', 'GERADA'].includes(statusEnvio ?? '')) {
      return NextResponse.json(
        {
          error: statusEnvio === 'COMPRA_INCERTA'
            ? 'Confirme primeiro o resultado da compra da etiqueta no Melhor Envio antes de estornar o pedido.'
            : 'A etiqueta já foi comprada. Cancele o envio no Melhor Envio antes de estornar o pedido.',
        },
        { status: 409 },
      )
    }
    const cancelamento = await cancelarPedidoPagoAdministrativamente(params.id, descricao)
    if (!cancelamento.ok) {
      const erro = cancelamento.motivo === 'PAGAMENTO_APROVADO_NAO_ENCONTRADO'
        ? 'Pagamento aprovado não localizado no histórico. Concilie o Mercado Pago antes de cancelar.'
        : 'O pedido mudou de estado durante o cancelamento. Recarregue e tente novamente.'
      return NextResponse.json({ error: erro }, { status: 409 })
    }
    const reembolso = await processarReembolso(cancelamento.reembolsoId)
    const pedido = await prisma.order.findUniqueOrThrow({ where: { id: params.id } })
    return NextResponse.json({
      ...pedido,
      reembolso,
      avisoOlist: currentOrder.olistOrderId
        ? 'Pedido também deve ser cancelado no Olist/Tiny antes da expedição.'
        : currentOrder.olistSyncStatus === 'INCERTO' || currentOrder.olistSyncStatus?.startsWith('PROCESSANDO:')
          ? 'O recebimento deste pedido pelo Olist estava incerto. Confira pelo número do e-commerce e cancele a venda no Olist se ela existir.'
          : null,
    })
  }

  const atualizado = await prisma.$transaction(async (tx) => {
    const mudou = await tx.order.updateMany({
      where: { id: params.id, status: atual },
      data: { status },
    })
    if (!mudou.count) return null
    await tx.orderTracking.create({
      data: { orderId: params.id, status, descricao },
    })
    return tx.order.findUniqueOrThrow({ where: { id: params.id } })
  })
  if (!atualizado) {
    return NextResponse.json(
      { error: 'O pedido mudou de estado. Recarregue e tente novamente.' },
      { status: 409 },
    )
  }

  if (status === 'ENVIADO' || status === 'ENTREGUE') {
    await agendarNotificacoesEtapaPedido(
      params.id,
      status === 'ENTREGUE' ? 'PEDIDO_ENTREGUE' : 'PEDIDO_ENVIADO',
    ).catch((error) => {
      console.error(
        `[status-api] notificação ${status} pendente para ${currentOrder.orderNumber}:`,
        error instanceof Error ? error.message : 'falha desconhecida',
      )
    })
  }

  // Notificações transacionais de retirada não podem reverter a transição.
  if (status === 'ENVIADO' && isRetirada) {
    const endereco = (currentOrder.enderecoEntrega ?? {}) as Record<string, unknown>
    const nome = String(endereco.nome ?? currentOrder.user?.nome ?? 'Cliente')
    const telefone = endereco.telefone ?? currentOrder.user?.telefone
    if (telefone && endereco.whatsappTransacionalAutorizado === true) {
      try {
        const { enfileirarMensagem } = await import('@/lib/evolution/queue')
        const { normalizarWhatsApp } = await import('@/lib/evolution/client')
        const { msgPedidoProntoRetirada } = await import('@/lib/evolution/templates')
        const wa = normalizarWhatsApp(String(telefone))
        const lead = await prisma.crmLead.findFirst({ where: { whatsapp: wa } })
        await enfileirarMensagem({
          whatsapp: wa,
          nome,
          tipo: 'MANUAL',
          leadId: lead?.id,
          userId: currentOrder.userId ?? undefined,
          payload: { conteudo: msgPedidoProntoRetirada(nome, currentOrder.orderNumber) },
        })
      } catch (error) {
        console.error('[status-api] Falha ao enfileirar mensagem de retirada:', error)
      }
    }

    const email = endereco.email ?? currentOrder.user?.email
    if (email) {
      try {
        const { enviarEmailProntoRetirada } = await import('@/lib/email/send')
        await enviarEmailProntoRetirada({
          para: String(email),
          nomeCliente: nome,
          numeroPedido: currentOrder.orderNumber,
        })
      } catch (error) {
        console.error('[status-api] Falha ao enviar e-mail de retirada:', error)
      }
    }
  }

  return NextResponse.json(atualizado)
}
