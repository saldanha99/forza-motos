import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { replicarPedidoOlist } from '@/lib/olist/sync-orders'
import { enfileirarMensagem, processarMensagem } from '@/lib/evolution/queue'
import { processarEmail } from '@/lib/email/queue'
import { agendarNotificacoesClientePedido } from '@/lib/checkout/notificacoes-pedido'
import { resumirPreVenda } from '@/lib/checkout/prevenda'
import { ehServicoMelhorEnvio } from '@/lib/frete/servico'

/**
 * Executa um efeito local uma única vez por pedido.
 *
 * O advisory lock fecha a corrida entre webhook, reconciliação e reentregas.
 * A gravação do efeito e, quando aplicável, da mensagem na outbox ocorre na
 * mesma transação: ou ambos existem, ou nenhum existe para o próximo retry.
 */
async function executarUmaVez(
  orderId: string,
  marcador: string,
  descricao: string,
  executar: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const chave = `pedido-confirmado:${orderId}:${marcador}`
    await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT true AS locked
      FROM pg_advisory_xact_lock(hashtextextended(${chave}, 0))
    `

    const concluido = await tx.orderTracking.findFirst({
      where: { orderId, status: marcador },
      select: { id: true },
    })
    if (concluido) return false

    await executar(tx)
    await tx.orderTracking.create({
      data: { orderId, status: marcador, descricao },
    })
    return true
  })
}

/**
 * Efeitos posteriores à confirmação financeira do pedido.
 *
 * Esta função é compartilhada pelo webhook e pela reconciliação. Cada efeito
 * possui proteção persistente própria, portanto reentregas apenas completam o
 * que ficou pendente e não duplicam e-mail, WhatsApp ou pedido no Olist.
 * Falhas externas nunca revertem um pagamento já confirmado.
 */
export async function efeitosPedidoConfirmado(
  orderId: string,
  metodo: string | null | undefined,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { select: { nome: true } } } },
      user: { select: { nome: true, telefone: true, email: true } },
      eventoPirelli: { select: { titulo: true } },
    },
  })
  if (!order) return

  if (process.env.POS_PAGAMENTO_INTEGRACOES_HABILITADAS === 'false') {
    await executarUmaVez(
      orderId,
      'EFEITO:INTEGRACOES_DESABILITADAS',
      'Integrações externas desabilitadas no ambiente de teste; nenhuma chamada a Olist, Melhor Envio, e-mail ou WhatsApp foi realizada.',
      async () => {},
    )
    return
  }

  const endereco = (order.enderecoEntrega ?? {}) as Record<string, unknown>
  const nomeCliente = order.user?.nome ?? String(endereco.nome ?? 'Cliente')
  const pedidoEventoPirelli = order.canal === 'EVENTO_PIRELLI' || Boolean(order.eventoPirelliId)
  const resumoPreVenda = resumirPreVenda(order.items.map((item) => ({
    preVenda: item.preVendaSnapshot,
    prazoEntregaDias: item.prazoEntregaDiasSnapshot,
  })))
  // A máquina financeira normalmente já gravou estas linhas no mesmo
  // commit. O UPSERT também repara pedidos confirmados por versões antigas.
  const outboxes = await agendarNotificacoesClientePedido(orderId)
  await Promise.allSettled([
    outboxes.whatsappId ? processarMensagem(outboxes.whatsappId) : Promise.resolve(),
    outboxes.emailId ? processarEmail(outboxes.emailId) : Promise.resolve(),
  ])

  // Olist já possui lease atômico próprio no pedido. O Melhor Envio só pode
  // ser acionado depois da NF-e e, por isso, não faz parte do webhook financeiro.
  let replicadoOk = Boolean(order.olistOrderId)
  let replicacaoEmAndamento = false
  if (pedidoEventoPirelli && !order.olistOrderId) {
    await executarUmaVez(
      orderId,
      'EFEITO:OLIST_ADIADO_EVENTO',
      'Pré-venda Pirelli não replicada automaticamente no Olist. A ação manual continua disponível quando os produtos estiverem prontos para faturamento e expedição.',
      async () => {},
    )
  } else if (!order.olistOrderId) {
    try {
      const resultado = await replicarPedidoOlist(orderId)
      replicacaoEmAndamento = Boolean(
        resultado && typeof resultado === 'object' && 'processando' in resultado && resultado.processando,
      )
      replicadoOk = !replicacaoEmAndamento
      if (replicadoOk) {
        console.log(`[pos-pagamento] Pedido ${order.orderNumber} replicado no Olist`)
      }
    } catch (error) {
      console.error('[pos-pagamento] Falha ao replicar Olist:', error)
      await prisma.orderTracking.create({
        data: {
          orderId,
          status: 'CONFIRMADO',
          descricao: `⚠️ Pagamento aprovado mas replicação no Olist falhou: ${String(error).slice(0, 200)}. Tentar novamente manualmente.`,
        },
      }).catch(() => {})
    }
  }

  // Uma execução concorrente que ganhou o lease do Olist também concluirá a
  // notificação administrativa com o resultado definitivo.
  if (replicacaoEmAndamento) return

  const envioMe = pedidoEventoPirelli
    ? order.freteServico === 'retirada'
      ? '⏳ Pré-venda com retirada: não liberar agora. Avise o cliente somente quando os produtos estiverem disponíveis.'
      : '⏳ Pré-venda com entrega: não gerar etiqueta agora. Replicar/faturar manualmente e preparar o envio quando os produtos estiverem disponíveis.'
    : order.freteServico === 'retirada'
      ? '📍 Retirada na loja — não gerar etiqueta.'
      : ehServicoMelhorEnvio(order.freteServico)
        ? '📮 Aguardando a NF-e do Olist. Depois, registre a chave no pedido e prepare/compre a etiqueta no painel.'
        : '📮 Serviço de frete de fallback: conferir a expedição manualmente no painel.'

  try {
    const itensTexto = order.items
      .map((item) => {
        const prazo = item.preVendaSnapshot && item.prazoEntregaDiasSnapshot
          ? ` — pré-venda, até ${item.prazoEntregaDiasSnapshot} dias úteis`
          : ''
        return `  • ${item.product?.nome ?? item.productId} (${item.quantidade}x)${prazo}`
      })
      .join('\n')
    const totalFmt = new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL',
    }).format(Number(order.total ?? 0))
    const statusOlist = pedidoEventoPirelli
      ? order.olistOrderId
        ? '✅ Pré-venda já replicada manualmente no Olist.\n👉 Respeitar a disponibilidade antes de separar ou despachar.'
        : '⏸️ *OLIST ADIADO* — comportamento esperado para esta pré-venda.\n👉 Use “Replicar no Olist” manualmente quando os produtos estiverem disponíveis.'
      : replicadoOk
        ? '✅ Replicado no Olist.\n👉 Separar, embalar e despachar!'
        : '⚠️ O recebimento pelo Olist ainda não foi confirmado.\n👉 Aguarde a reconciliação e confira no Olist antes de qualquer reenvio.'
    const contextoPreVenda = resumoPreVenda.preVenda
      ? `🏁 Canal: Pré-venda Pirelli${order.eventoPirelli?.titulo ? ` — ${order.eventoPirelli.titulo}` : ''}\n` +
        `⏳ Maior prazo de disponibilidade: ${resumoPreVenda.prazoMaximoDias ?? 'não informado'} dias úteis\n`
      : ''
    const mensagemAdmin = await enfileirarMensagem({
      chaveIdempotencia: `pedido:${orderId}:whatsapp:admin:confirmado`,
      whatsapp: process.env.ADMIN_WHATSAPP ?? '5519974049445',
      nome: 'Admin',
      tipo: 'MANUAL',
      payload: {
        conteudo:
          `🛒 *NOVO PEDIDO PAGO — Forza Motos*\n\n` +
          `📦 Pedido: ${order.orderNumber}\n` +
          `👤 Cliente: ${nomeCliente}\n` +
          `💳 Forma: ${metodo ?? 'mercadopago'}\n` +
          `💰 Total: ${totalFmt}\n\n` +
          contextoPreVenda +
          `Itens:\n${itensTexto}\n\n` +
          `${statusOlist}\n\n${envioMe}`,
      },
    })
    await executarUmaVez(
      orderId,
      'EFEITO:WHATSAPP_ADMIN',
      'WhatsApp administrativo enfileirado.',
      async () => {},
    )
    await processarMensagem(mensagemAdmin.id)
  } catch (error) {
    console.error('[pos-pagamento] Falha ao notificar admin:', error)
  }
}
