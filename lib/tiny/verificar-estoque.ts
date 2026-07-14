/**
 * Verificação de estoque em tempo real no Tiny ERP
 *
 * Usado em duas camadas:
 *   1. Na criação do pedido (/api/pedidos) — bloqueia antes do pagamento
 *   2. No webhook do MP (/api/mercadopago/webhook) — valida antes de confirmar
 *
 * Produtos dropshipping (estoque=999) têm tolerância configurável.
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

/**
 * Verifica estoque real no Tiny para uma lista de itens.
 * Retorna quais produtos não têm estoque suficiente.
 *
 * @param opts.atualizarBanco  Quando true (default), grava o saldo real no banco.
 *   Use `false` ao CONFIRMAR um pedido já reservado (ex.: webhook do Mercado Pago):
 *   nesse momento o estoque local já foi debitado na criação do pedido e o Olist
 *   ainda não baixou, então sobrescrever com o valor do Olist REVERTERIA a reserva
 *   e abriria janela de oversell. Aqui só queremos checar disponibilidade.
 */
export async function verificarEstoqueTiny(
  itens: ItemParaVerificar[],
  opts: { atualizarBanco?: boolean } = {},
): Promise<ResultadoVerificacao> {
  const { atualizarBanco = true } = opts
  const esgotados: ResultadoVerificacao['esgotados'] = []

  // Busca os produtos no banco (com tinyId para checar na API)
  const produtos = await prisma.product.findMany({
    where: { id: { in: itens.map((i) => i.productId) } },
    select: { id: true, tinyId: true, nome: true, estoque: true, temImagem: true },
  })

  // Verifica cada produto em paralelo para manter velocidade razoável
  await Promise.allSettled(
    produtos.map(async (produto) => {
      const item = itens.find((i) => i.productId === produto.id)
      if (!item) return

      // Produto sem tinyId: confia no DB (produto cadastrado manualmente)
      if (!produto.tinyId) {
        if (produto.estoque < item.quantidade) {
          esgotados.push({
            productId: produto.id,
            nome: produto.nome,
            estoqueReal: produto.estoque,
            quantidade: item.quantidade,
          })
        }
        return
      }

      // Busca estoque real no Tiny
      const estoqueReal = await fetchTinyProductEstoque(produto.tinyId)

      // API retornou erro (-1): usa valor do DB como fallback
      if (estoqueReal === -1) {
        if (produto.estoque < item.quantidade) {
          esgotados.push({
            productId: produto.id,
            nome: produto.nome,
            estoqueReal: produto.estoque,
            quantidade: item.quantidade,
          })
        }
        return
      }

      // Atualiza DB com valor real (mantém banco sincronizado) — exceto em
      // modo somente-checagem, para não reverter reservas de pedidos pendentes.
      if (atualizarBanco) {
        const ativo = produto.temImagem && estoqueReal > 0
        await prisma.product.update({
          where: { id: produto.id },
          data: { estoque: estoqueReal, ativo },
        }).catch(() => {}) // não bloqueia o checkout se falhar
      }

      // (999 extinto em 09/07 — estoque é sempre o saldo real)

      if (estoqueReal < item.quantidade) {
        esgotados.push({
          productId: produto.id,
          nome: produto.nome,
          estoqueReal,
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
 * Devolve ao estoque local as quantidades reservadas por um pedido.
 *
 * Usado quando um pagamento é recusado/cancelado/expira: como o estoque é
 * debitado na criação do pedido (reserva) e o pedido nunca chegou ao Olist,
 * precisamos restaurar a reserva para o produto voltar a ficar disponível.
 *
 * Reativa o produto se voltar a ter saldo e tiver imagem.
 */
export async function restaurarEstoquePedido(
  itens: Array<{ productId: string; quantidade: number }>,
): Promise<void> {
  await Promise.allSettled(
    itens.map(async (item) => {
      const produto = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { estoque: true, temImagem: true },
      })
      if (!produto) return
      const novoEstoque = produto.estoque + item.quantidade
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          estoque: novoEstoque,
          ativo: novoEstoque > 0 && produto.temImagem,
        },
      })
    }),
  )
}
