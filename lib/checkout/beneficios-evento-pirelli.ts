import { Prisma } from '@prisma/client'
import { bloquearVisitanteEvento, criarElegibilidadeDeCaneca } from '@/lib/evento-pirelli'
import { SKU_CANECA_EVENTO_PIRELLI } from '@/lib/checkout/caneca-evento-pirelli'

type ItemParaSubtotalPneus = {
  quantidade: number
  precoUnitario: Prisma.Decimal | number | string
  product: {
    sku: string
    categoria: string
  }
}

export function categoriaContaComoPneu(categoria: string) {
  const normalizada = categoria
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
  return /^PNEUS?(?:\s|$)/.test(normalizada)
}

/**
 * Soma somente linhas cuja categoria é de pneus. O SKU técnico da caneca é
 * excluído também de forma explícita, para que uma edição administrativa
 * acidental da categoria nunca transforme a própria caneca em brinde grátis.
 */
export function subtotalPneusDoPedido(itens: ItemParaSubtotalPneus[]) {
  return itens.reduce((total, item) => {
    if (
      item.product.sku === SKU_CANECA_EVENTO_PIRELLI ||
      !categoriaContaComoPneu(item.product.categoria)
    ) return total
    return total.plus(new Prisma.Decimal(item.precoUnitario).mul(item.quantidade))
  }, new Prisma.Decimal(0))
}

export function atingiuValorMinimoPneus(
  subtotal: Prisma.Decimal | number | string,
  minimo: Prisma.Decimal | number | string,
  operador: 'MAIOR_QUE' | 'MAIOR_OU_IGUAL',
) {
  const valor = new Prisma.Decimal(subtotal)
  const limite = new Prisma.Decimal(minimo)
  return operador === 'MAIOR_OU_IGUAL'
    ? valor.greaterThanOrEqualTo(limite)
    : valor.greaterThan(limite)
}

/**
 * Materializa os efeitos operacionais que nascem junto com a confirmação
 * financeira. A função deve rodar DENTRO da mesma transação que muda o Order
 * para CONFIRMADO: uma queda nunca pode deixar pedido pago sem a caneca ou sem
 * a elegibilidade correspondente.
 */
export async function aplicarBeneficiosPedidoPirelliPago(
  tx: Prisma.TransactionClient,
  orderId: string,
  pagamento: { formaPagamento: 'PIX_MERCADO_PAGO' | 'MERCADO_PAGO'; referenciaPagamento?: string | null },
) {
  const pedido = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      enderecoEntrega: true,
      canal: true,
      eventoPirelliId: true,
      eventoPirelliVisitanteId: true,
      eventoPirelli: {
        select: {
          valorMinimoPneus: true,
          operadorValorMinimoPneus: true,
        },
      },
      eventoPirelliVisitante: {
        select: {
          id: true,
          eventoId: true,
        },
      },
      items: {
        select: {
          quantidade: true,
          precoUnitario: true,
          product: {
            select: {
              sku: true,
              categoria: true,
              eventoPirelliId: true,
            },
          },
        },
      },
    },
  })

  if (
    pedido.canal !== 'EVENTO_PIRELLI' ||
    !pedido.eventoPirelliId ||
    !pedido.eventoPirelliVisitanteId
  ) {
    return { compraCanecaCriada: false, elegibilidadePneusCriada: false, subtotalPneus: 0 }
  }

  const visitante = pedido.eventoPirelliVisitante
  const evento = pedido.eventoPirelli
  if (
    !visitante ||
    !evento ||
    visitante.id !== pedido.eventoPirelliVisitanteId ||
    visitante.eventoId !== pedido.eventoPirelliId
  ) {
    // Fail-closed: um vínculo cruzado não pode entregar brinde a outra pessoa.
    throw new Error('EVENTO_PIRELLI_VINCULO_FINANCEIRO_INVALIDO')
  }
  await bloquearVisitanteEvento(tx, visitante.id)

  const itensCaneca = pedido.items.filter((item) => item.product.sku === SKU_CANECA_EVENTO_PIRELLI)
  const quantidadeCanecas = itensCaneca.reduce((total, item) => total + item.quantidade, 0)
  if (itensCaneca.some((item) => item.product.eventoPirelliId !== pedido.eventoPirelliId)) {
    throw new Error('EVENTO_PIRELLI_PRODUTO_CANECA_INVALIDO')
  }

  let compraCanecaCriada = false
  const endereco = pedido.enderecoEntrega && typeof pedido.enderecoEntrega === 'object' && !Array.isArray(pedido.enderecoEntrega)
    ? pedido.enderecoEntrega as Record<string, unknown>
    : {}
  const nomeGravacaoCaneca = String(endereco.nomeGravacao ?? endereco.nomeGravacaoEventoPirelli ?? '').trim()
  if (quantidadeCanecas > 0) {
    if (!nomeGravacaoCaneca) throw new Error('EVENTO_PIRELLI_NOME_CANECA_AUSENTE')
    await tx.eventoPirelliVisitante.update({
      where: { id: visitante.id },
      data: {
        nomeGravacao: nomeGravacaoCaneca,
        nomeGravacaoConfirmadoEm: new Date(),
        nomeGravacaoConfirmadoPor: 'Cliente no checkout online',
      },
    })
    await tx.eventoPirelliCompraCaneca.upsert({
      where: { orderId: pedido.id },
      create: {
        eventoId: pedido.eventoPirelliId,
        visitanteId: visitante.id,
        orderId: pedido.id,
        quantidade: quantidadeCanecas,
        nomeGravacaoSnapshot: nomeGravacaoCaneca,
        referenciaVenda: pedido.orderNumber,
        formaPagamento: pagamento.formaPagamento,
        valorUnitarioSnapshot: itensCaneca[0]?.precoUnitario,
        valorPago: itensCaneca.reduce(
          (total, item) => total.plus(new Prisma.Decimal(item.precoUnitario).mul(item.quantidade)),
          new Prisma.Decimal(0),
        ),
        pagamentoConfirmadoEm: new Date(),
        pagamentoConfirmadoPor: 'Sistema - Mercado Pago',
        referenciaPagamento: pagamento.referenciaPagamento ?? pedido.orderNumber,
        chaveIdempotencia: `pedido:${pedido.id}:caneca`,
        status: 'PENDENTE',
        observacao: 'Pagamento confirmado automaticamente pelo Mercado Pago.',
      },
      update: {},
    })
    await tx.eventoPirelliLancamentoCaixa.upsert({
      where: { chaveIdempotencia: `pedido:${pedido.id}:caixa-caneca` },
      create: {
        eventoId: pedido.eventoPirelliId,
        visitanteId: visitante.id,
        tipo: 'VENDA_CANECA',
        origem: 'CHECKOUT_MERCADO_PAGO',
        quantidade: quantidadeCanecas,
        valorUnitario: itensCaneca[0]?.precoUnitario,
        valorTotal: itensCaneca.reduce(
          (total, item) => total.plus(new Prisma.Decimal(item.precoUnitario).mul(item.quantidade)),
          new Prisma.Decimal(0),
        ),
        formaPagamento: pagamento.formaPagamento,
        referenciaPagamento: pagamento.referenciaPagamento ?? pedido.orderNumber,
        referenciaVenda: pedido.orderNumber,
        confirmadoEm: new Date(),
        confirmadoPor: 'Sistema - Mercado Pago',
        chaveIdempotencia: `pedido:${pedido.id}:caixa-caneca`,
        observacao: 'Venda online de caneca confirmada pelo Mercado Pago.',
      },
      update: {},
    })
    compraCanecaCriada = true
  }

  const subtotalPneus = subtotalPneusDoPedido(pedido.items)
  const elegivel = atingiuValorMinimoPneus(
    subtotalPneus,
    evento.valorMinimoPneus,
    evento.operadorValorMinimoPneus,
  )
  if (subtotalPneus.greaterThan(0)) {
    await tx.eventoPirelliLancamentoCaixa.upsert({
      where: { chaveIdempotencia: `pedido:${pedido.id}:caixa-pneus` },
      create: {
        eventoId: pedido.eventoPirelliId,
        visitanteId: visitante.id,
        tipo: 'COMPRA_PNEUS',
        origem: 'CHECKOUT_MERCADO_PAGO',
        valorTotal: subtotalPneus,
        formaPagamento: pagamento.formaPagamento,
        referenciaPagamento: pagamento.referenciaPagamento ?? pedido.orderNumber,
        referenciaVenda: pedido.orderNumber,
        confirmadoEm: new Date(),
        confirmadoPor: 'Sistema - Mercado Pago',
        chaveIdempotencia: `pedido:${pedido.id}:caixa-pneus`,
        observacao: 'Compra online de pneus confirmada pelo Mercado Pago.',
      },
      update: {},
    })
  }
  if (elegivel) {
    await criarElegibilidadeDeCaneca({
      visitanteId: visitante.id,
      origem: 'COMPRA_PNEUS',
      valorPneus: subtotalPneus.toNumber(),
      referenciaVenda: pedido.orderNumber,
      formaPagamento: pagamento.formaPagamento,
      pagamentoConfirmadoEm: new Date(),
      pagamentoConfirmadoPor: 'Sistema - Mercado Pago',
      referenciaPagamento: pagamento.referenciaPagamento ?? pedido.orderNumber,
      validadoPor: 'Sistema — pedido Pirelli pago',
      observacao: 'Elegibilidade concedida automaticamente após confirmação do Mercado Pago.',
      nomeGravacao: nomeGravacaoCaneca || null,
    }, tx)
  }

  return {
    compraCanecaCriada,
    elegibilidadePneusCriada: elegivel,
    subtotalPneus: subtotalPneus.toNumber(),
  }
}

/**
 * Reverte, no mesmo commit do cancelamento financeiro, os efeitos operacionais
 * criados na aprovação. A linha da compra avulsa permanece como auditoria, mas
 * passa a CANCELADA. O brinde por pneus só é revogado quando esta era a venda
 * que sustentava a origem e não há outro pedido pago que ainda atinja a regra.
 */
export async function reverterBeneficiosPedidoPirelliCancelado(
  tx: Prisma.TransactionClient,
  orderId: string,
  contexto: { por: string; motivo: string },
) {
  const pedido = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      canal: true,
      eventoPirelliId: true,
      eventoPirelliVisitanteId: true,
      eventoPirelli: {
        select: {
          valorMinimoPneus: true,
          operadorValorMinimoPneus: true,
        },
      },
    },
  })

  if (pedido?.eventoPirelliVisitanteId) {
    await bloquearVisitanteEvento(tx, pedido.eventoPirelliVisitanteId)
  }

  await tx.eventoPirelliLancamentoCaixa.updateMany({
    where: {
      chaveIdempotencia: { startsWith: `pedido:${orderId}:caixa-` },
      estornadoEm: null,
    },
    data: {
      estornadoEm: new Date(),
      estornadoPor: contexto.por,
      estornoMotivo: contexto.motivo.slice(0, 2_000),
    },
  })

  const compraCancelada = await tx.eventoPirelliCompraCaneca.updateMany({
    where: {
      orderId,
      status: { not: 'CANCELADA' },
    },
    data: {
      status: 'CANCELADA',
      observacao: `Compra cancelada após reversão financeira. ${contexto.motivo}`.slice(0, 2_000),
    },
  })

  if (
    !pedido ||
    pedido.canal !== 'EVENTO_PIRELLI' ||
    !pedido.eventoPirelliId ||
    !pedido.eventoPirelliVisitanteId ||
    !pedido.eventoPirelli
  ) {
    return { compraCanecaCancelada: compraCancelada.count > 0, elegibilidadePneusRevogada: false }
  }

  const elegibilidade = await tx.eventoPirelliElegibilidadeCaneca.findUnique({
    where: {
      visitanteId_origem: {
        visitanteId: pedido.eventoPirelliVisitanteId,
        origem: 'COMPRA_PNEUS',
      },
    },
  })
  if (
    !elegibilidade ||
    elegibilidade.revogadoEm ||
    elegibilidade.referenciaVenda !== pedido.orderNumber
  ) {
    return { compraCanecaCancelada: compraCancelada.count > 0, elegibilidadePneusRevogada: false }
  }

  // Se outra venda paga ainda sustenta o direito, move a referência para ela
  // em vez de revogar a única linha (a origem é única por visitante).
  const outrosPedidos = await tx.order.findMany({
    where: {
      id: { not: pedido.id },
      canal: 'EVENTO_PIRELLI',
      eventoPirelliId: pedido.eventoPirelliId,
      eventoPirelliVisitanteId: pedido.eventoPirelliVisitanteId,
      status: { in: ['CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE'] },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      orderNumber: true,
      items: {
        select: {
          quantidade: true,
          precoUnitario: true,
          product: { select: { sku: true, categoria: true } },
        },
      },
    },
  })
  const substituto = outrosPedidos
    .map((outro) => ({ outro, subtotal: subtotalPneusDoPedido(outro.items) }))
    .find(({ subtotal }) => atingiuValorMinimoPneus(
      subtotal,
      pedido.eventoPirelli!.valorMinimoPneus,
      pedido.eventoPirelli!.operadorValorMinimoPneus,
    ))

  if (substituto) {
    await tx.eventoPirelliElegibilidadeCaneca.update({
      where: { id: elegibilidade.id },
      data: {
        referenciaVenda: substituto.outro.orderNumber,
        valorPneus: substituto.subtotal,
        observacao: `Direito preservado por outro pedido pago após cancelamento de ${pedido.orderNumber}.`,
        validadoPor: 'Sistema — reconciliação de cancelamento',
      },
    })
    return { compraCanecaCancelada: compraCancelada.count > 0, elegibilidadePneusRevogada: false }
  }

  await tx.eventoPirelliElegibilidadeCaneca.update({
    where: { id: elegibilidade.id },
    data: {
      revogadoEm: new Date(),
      revogadoPor: contexto.por,
      revogadoMotivo: contexto.motivo,
    },
  })
  const outrasOrigens = await tx.eventoPirelliElegibilidadeCaneca.count({
    where: {
      visitanteId: pedido.eventoPirelliVisitanteId,
      revogadoEm: null,
    },
  })
  if (outrasOrigens === 0) {
    await tx.eventoPirelliCaneca.updateMany({
      where: { visitanteId: pedido.eventoPirelliVisitanteId },
      data: { status: 'CANCELADA' },
    })
  }

  return { compraCanecaCancelada: compraCancelada.count > 0, elegibilidadePneusRevogada: true }
}
