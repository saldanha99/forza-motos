/**
 * Verificação de estoque em tempo real no Tiny ERP
 *
 * `Product.estoque` é saldo físico; `estoqueReservado` é a parte segurada por
 * checkouts pendentes. Sincronizar o físico nunca pode apagar a reserva local.
 */

import { fetchTinyProductEstoque } from '@/lib/olist/client'
import { prisma } from '@/lib/prisma'

export interface ItemParaVerificar {
  productId: string
  quantidade: number
}

export interface ResultadoVerificacao {
  ok: boolean
  esgotados: Array<{ productId: string; nome: string; estoqueReal: number; quantidade: number }>
}

export type ModoVerificacao = 'disponibilidade' | 'confirmacao'

/**
 * Verifica estoque real no Tiny para uma lista de itens.
 * Retorna quais produtos não têm estoque suficiente.
 *
 * @param opts.modo Em `disponibilidade`, desconta todas as reservas pendentes.
 *   Em `confirmacao`, confere o saldo físico para um pedido cuja própria
 *   reserva ainda existe e será consumida na mesma transação da aprovação.
 */
export async function verificarEstoqueTiny(
  itens: ItemParaVerificar[],
  opts: { atualizarBanco?: boolean; modo?: ModoVerificacao } = {},
): Promise<ResultadoVerificacao> {
  const { atualizarBanco = true, modo = 'disponibilidade' } = opts
  const esgotados: ResultadoVerificacao['esgotados'] = []

  // Busca os produtos no banco (com tinyId para checar na API)
  const produtos = await prisma.product.findMany({
    where: { id: { in: itens.map((i) => i.productId) } },
    select: {
      id: true,
      tinyId: true,
      nome: true,
      estoque: true,
      estoqueReservado: true,
      temImagem: true,
      ocultoManual: true,
    },
  })

  // Verifica cada produto em paralelo para manter velocidade razoável
  await Promise.allSettled(
    produtos.map(async (produto) => {
      const item = itens.find((i) => i.productId === produto.id)
      if (!item) return

      const saldoTiny = produto.tinyId ? await fetchTinyProductEstoque(produto.tinyId) : -1
      const consultouTiny = saldoTiny !== -1
      const saldoFisico = consultouTiny ? saldoTiny : produto.estoque

      // Atualiza apenas o físico; a reserva fica intacta em outra coluna.
      if (atualizarBanco && consultouTiny) {
        const disponivel = saldoTiny - produto.estoqueReservado
        await prisma.product.update({
          where: { id: produto.id },
          data: {
            estoque: saldoTiny,
            ativo: !produto.ocultoManual && produto.temImagem && disponivel > 0,
          },
        }).catch(() => {}) // não bloqueia o checkout se falhar
      }

      const saldoEfetivo = modo === 'confirmacao'
        ? saldoFisico
        : saldoFisico - produto.estoqueReservado

      if (saldoEfetivo < item.quantidade) {
        esgotados.push({
          productId: produto.id,
          nome: produto.nome,
          estoqueReal: saldoEfetivo,
          quantidade: item.quantidade,
        })
      }
    }),
  )

  return {
    ok: esgotados.length === 0,
    esgotados,
  }
}

/**
 * Compatibilidade com o webhook antigo. O fluxo novo libera por OrderItem em
 * `lib/checkout/reserva.ts`, que é idempotente. Aqui nunca se soma ao físico:
 * no máximo se solta o contador local de reserva.
 */
export async function restaurarEstoquePedido(
  itens: Array<{ productId: string; quantidade: number }>,
): Promise<void> {
  await Promise.allSettled(
    itens.map(async (item) => {
      await prisma.$executeRaw`
        UPDATE "Product"
        SET "estoqueReservado" = GREATEST(0, "estoqueReservado" - ${item.quantidade}),
            "ativo" = CASE
              WHEN "estoque" - GREATEST(0, "estoqueReservado" - ${item.quantidade}) > 0
                AND "temImagem" = true AND "ocultoManual" = false
              THEN true ELSE "ativo"
            END,
            "updatedAt" = NOW()
        WHERE "id" = ${item.productId}
      `
    }),
  )
}
