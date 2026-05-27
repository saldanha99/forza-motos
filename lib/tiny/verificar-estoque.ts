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
 * Atualiza o banco com os valores reais encontrados.
 * Retorna quais produtos não têm estoque suficiente.
 */
export async function verificarEstoqueTiny(
  itens: ItemParaVerificar[],
): Promise<ResultadoVerificacao> {
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

      // Atualiza DB com valor real (mantém banco sincronizado)
      const ativo = produto.temImagem && estoqueReal > 0
      await prisma.product.update({
        where: { id: produto.id },
        data: { estoque: estoqueReal, ativo },
      }).catch(() => {}) // não bloqueia o checkout se falhar

      // Dropshipping (999) = sempre disponível via fornecedor
      if (estoqueReal === 999) return

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
