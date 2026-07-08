import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const DESCRICOES: Record<string, string> = {
  CONFIRMADO: 'Pagamento confirmado — pedido em processamento.',
  SEPARANDO: 'Pedido sendo separado no estoque.',
  ENVIADO: 'Pedido enviado para os Correios.',
  ENTREGUE: 'Pedido entregue ao destinatário.',
  CANCELADO: 'Pedido cancelado.',
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { status } = await req.json()

  const currentOrder = await prisma.order.findUnique({
    where: { id: params.id },
    select: {
      freteServico: true,
      orderNumber: true,
      userId: true,
      enderecoEntrega: true,
      user: {
        select: {
          nome: true,
          telefone: true,
          email: true,
        }
      }
    }
  })
  if (!currentOrder) {
    return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 })
  }

  const isRetirada = currentOrder.freteServico === 'retirada'
  let descricao = DESCRICOES[status] ?? `Status atualizado para ${status}`

  if (isRetirada) {
    if (status === 'ENVIADO') {
      descricao = 'Pedido disponível para retirada no balcão.'
    } else if (status === 'ENTREGUE') {
      descricao = 'Pedido retirado no balcão.'
    }
  }

  const pedido = await prisma.order.update({
    where: { id: params.id },
    data: {
      status,
      tracking: {
        create: {
          status,
          descricao,
        },
      },
    },
  })

  // Dispara notificações se o pedido estiver pronto para retirada
  if (status === 'ENVIADO' && isRetirada) {
    const nome = currentOrder.user?.nome ?? 'Cliente'
    const numeroPedido = currentOrder.orderNumber

    // 1) Enviar WhatsApp
    const telefone = currentOrder.user?.telefone
    if (telefone) {
      try {
        const { enfileirarMensagem } = await import('@/lib/evolution/queue')
        const { normalizarWhatsApp } = await import('@/lib/evolution/client')
        const { msgPedidoProntoRetirada } = await import('@/lib/evolution/templates')

        const wa = normalizarWhatsApp(telefone)
        const lead = await prisma.crmLead.findFirst({ where: { whatsapp: wa } })
        const msgText = msgPedidoProntoRetirada(nome, numeroPedido)

        await enfileirarMensagem({
          whatsapp: wa,
          nome,
          tipo: 'MANUAL',
          leadId: lead?.id,
          userId: currentOrder.userId ?? undefined,
          payload: { conteudo: msgText }
        })
      } catch (e) {
        console.error('[status-api] Falha ao enfileirar mensagem de retirada:', e)
      }
    }

    // 2) Enviar E-mail
    const email = currentOrder.user?.email ?? (currentOrder.enderecoEntrega as any)?.email
    if (email) {
      try {
        const { enviarEmailProntoRetirada } = await import('@/lib/email/send')
        await enviarEmailProntoRetirada({
          para: email,
          nomeCliente: nome,
          numeroPedido,
        })
      } catch (e) {
        console.error('[status-api] Falha ao enviar e-mail de retirada:', e)
      }
    }
  }

  return NextResponse.json(pedido)
}
