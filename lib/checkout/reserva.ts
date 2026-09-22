import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

const STATUS_CANCELAVEIS = ['AGUARDANDO_PAGAMENTO'] as const

/** Minutos que uma reserva local sobrevive sem pagamento aprovado. */
const minutosConfigurados = Number(process.env.CHECKOUT_RESERVA_MINUTOS ?? 120)
export const MINUTOS_RESERVA = Number.isFinite(minutosConfigurados) && minutosConfigurados > 0
  ? Math.min(Math.max(Math.trunc(minutosConfigurados), 5), 24 * 60)
  : 120

type TxClient = Prisma.TransactionClient

export function calcularExpiracaoReserva(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + MINUTOS_RESERVA * 60 * 1000)
}

/**
 * Reserva unidades de um produto.
 *
 * `Product.estoque` é o saldo FÍSICO — é o que o sync do Tiny sobrescreve. A
 * reserva vive em `Product.estoqueReservado`, que nenhum sync toca. O guard
 * compara as duas colunas na MESMA instrução, então dois checkouts simultâneos
 * na última unidade não podem ambos vencer, e uma sobrescrita do Tiny entre o
 * pré-check e o commit não repõe uma unidade já reservada.
 *
 * @returns true quando a reserva foi feita; false quando não há disponível.
 */
export async function reservarEstoque(
  tx: TxClient,
  productId: string,
  quantidade: number,
): Promise<boolean> {
  const afetados = await tx.$executeRaw`
    UPDATE "Product"
    SET "estoqueReservado" = "estoqueReservado" + ${quantidade},
        "updatedAt" = NOW()
    WHERE "id" = ${productId}
      AND "estoque" - "estoqueReservado" >= ${quantidade}
  `
  if (!afetados) return false

  // Sem disponível, some da vitrine (o admin pode ter ocultado antes; respeite).
  await tx.$executeRaw`
    UPDATE "Product"
    SET "ativo" = false, "updatedAt" = NOW()
    WHERE "id" = ${productId} AND "estoque" - "estoqueReservado" <= 0
  `
  return true
}

/** Devolve reservas ao pool disponível (pedido cancelado/expirado). */
async function devolverReservas(
  tx: TxClient,
  itens: Array<{ id: string; productId: string; quantidade: number }>,
): Promise<void> {
  for (const item of itens) {
    // O item é a fonte de verdade da reserva. Somente quem troca true→false
    // pode mexer no agregado do produto; isso mantém a operação idempotente
    // mesmo após falha parcial/reentrega do webhook.
    const liberado = await tx.orderItem.updateMany({
      where: { id: item.id, estoqueReservado: true },
      data: { estoqueReservado: false },
    })
    if (!liberado.count) continue

    // GREATEST protege contra um contador que já tenha sido zerado à mão.
    await tx.$executeRaw`
      UPDATE "Product"
      SET "estoqueReservado" = GREATEST(0, "estoqueReservado" - ${item.quantidade}),
          "updatedAt" = NOW()
      WHERE "id" = ${item.productId}
    `
    await tx.$executeRaw`
      UPDATE "Product"
      SET "ativo" = true, "updatedAt" = NOW()
      WHERE "id" = ${item.productId}
        AND "estoque" - "estoqueReservado" > 0
        AND "ocultoManual" = false
        AND "temImagem" = true
    `
  }
}

/**
 * Converte reservas em venda: a unidade sai do saldo físico E da reserva, de
 * modo que o disponível não muda na transição. O sync do Tiny reescreve o
 * físico depois, quando o Olist tiver baixado o pedido.
 */
async function consumirReservas(
  tx: TxClient,
  itens: Array<{ id: string; productId: string; quantidade: number }>,
): Promise<void> {
  for (const item of itens) {
    const consumido = await tx.orderItem.updateMany({
      where: { id: item.id, estoqueReservado: true },
      data: { estoqueReservado: false },
    })
    if (!consumido.count) continue

    await tx.$executeRaw`
      UPDATE "Product"
      SET "estoque" = GREATEST(0, "estoque" - ${item.quantidade}),
          "estoqueReservado" = GREATEST(0, "estoqueReservado" - ${item.quantidade}),
          "updatedAt" = NOW()
      WHERE "id" = ${item.productId}
    `
    await tx.$executeRaw`
      UPDATE "Product"
      SET "ativo" = false, "updatedAt" = NOW()
      WHERE "id" = ${item.productId} AND "estoque" - "estoqueReservado" <= 0
    `
  }
}

/**
 * Baixa definitiva das reservas de um pedido pago, dentro da transação que o
 * confirma. `reservaLiberadaEm` é a trava: um webhook reentregue não baixa o
 * estoque duas vezes.
 */
export async function consumirReservaDoPedido(tx: TxClient, orderId: string): Promise<boolean> {
  const itens = await tx.orderItem.findMany({
    where: { orderId, estoqueReservado: true },
    select: { id: true, productId: true, quantidade: true },
  })
  await consumirReservas(tx, itens)
  const marcado = await tx.order.updateMany({
    where: { id: orderId, reservaLiberadaEm: null },
    data: { reservaLiberadaEm: new Date() },
  })
  return marcado.count > 0 || itens.length > 0
}

/**
 * Cancela um pedido e compensa, na mesma transação, somente os recursos que
 * ele realmente reservou. Duas travas de idempotência: a transição de status
 * e `reservaLiberadaEm` — estoque e cupom só voltam quando esta chamada vence
 * as duas.
 */
export async function cancelarPedidoComCompensacao(
  orderId: string,
  descricao: string,
): Promise<boolean> {
  return prisma.$transaction((tx) => cancelarPedidoComCompensacaoTx(tx, orderId, descricao))
}

/**
 * Mesma compensação, porém participando de uma transação já aberta — usada
 * quando o cancelamento precisa nascer atômico junto de outro registro
 * durável (ex.: a linha de estorno em ReembolsoPagamento).
 */
export async function cancelarPedidoComCompensacaoTx(
  tx: TxClient,
  orderId: string,
  descricao: string,
): Promise<boolean> {
  const pedido = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      cupomCodigo: true,
      cupomConsumido: true,
      reservaLiberadaEm: true,
      items: { select: { id: true, productId: true, quantidade: true, estoqueReservado: true } },
    },
  })
  if (!pedido || !STATUS_CANCELAVEIS.includes(pedido.status as (typeof STATUS_CANCELAVEIS)[number])) return false

  const cancelado = await tx.order.updateMany({
    where: { id: orderId, status: { in: [...STATUS_CANCELAVEIS] } },
    data: {
      status: 'CANCELADO',
      pagamentoResultadoIncerto: false,
      cupomConsumido: false,
      reservaLiberadaEm: new Date(),
    },
  })
  if (!cancelado.count) return false

  await devolverReservas(tx, pedido.items.filter((item) => item.estoqueReservado))

  if (pedido.cupomConsumido && pedido.cupomCodigo) {
    await tx.cupom.updateMany({
      where: { codigo: pedido.cupomCodigo, usados: { gt: 0 } },
      data: { usados: { decrement: 1 } },
    })
  }

  await tx.orderTracking.create({
    data: { orderId, status: 'CANCELADO', descricao },
  })
  return true
}
