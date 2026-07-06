/**
 * Função principal de cotação de frete.
 *
 * Estratégia em camadas (degrade gracefully):
 *   1. Tenta Melhor Envio (todas transportadoras integradas)
 *   2. Se falhar, usa fallback hardcoded (lib/correios.ts)
 *
 * Use SEMPRE este módulo no checkout, nunca chame lib/correios.ts ou
 * lib/frete/melhor-envio.ts diretamente.
 */

import { prisma } from '@/lib/prisma'
import { cotarMelhorEnvio, type CotacaoResultado } from './melhor-envio'
import { dimensoesDoCarrinho } from './dimensoes'
import { calcularFrete as fallbackFrete } from '@/lib/correios'

export interface ItemCotacao {
  productId: string
  quantidade: number
}

export interface FreteOpcao {
  /** ID do serviço no Melhor Envio (ou código se fallback). Salve em Order.freteServico */
  id: string
  /** Nome legível mostrado ao cliente */
  nome: string
  /** Empresa transportadora */
  transportadora: string
  /** Logo da transportadora (URL absoluta ou path) */
  logo?: string
  /** Preço final em reais */
  preco: number
  /** Prazo em dias úteis */
  prazo: number
  /** Origem da cotação — útil pra debug */
  fonte: 'melhor-envio' | 'fallback' | 'loja'
}

/** Retirada na loja física — sempre disponível, sem custo */
function opcaoRetirada(): FreteOpcao {
  return {
    id: 'retirada',
    nome: 'Retirar na loja',
    transportadora: 'R. Funilense, 110 — Campinas/SP',
    preco: 0,
    prazo: 0,
    fonte: 'loja',
  }
}

/**
 * Cota o frete para o carrinho informado.
 *
 * Retorna lista ordenada pelo menor preço.
 */
export async function cotarFrete(input: {
  cepDestino: string
  items: ItemCotacao[]
  valorTotal: number
}): Promise<FreteOpcao[]> {
  // 1) Busca produtos e calcula dimensões agregadas
  const produtos = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) } },
    select: {
      id: true,
      categoria: true,
      peso: true,
      altura: true,
      largura: true,
      comprimento: true,
    },
  })

  const itemsComProduto = input.items
    .map((i) => {
      const produto = produtos.find((p) => p.id === i.productId)
      if (!produto) return null
      return {
        quantidade: i.quantidade,
        produto: {
          categoria: produto.categoria,
          peso: produto.peso ? Number(produto.peso) : null,
          altura: produto.altura ? Number(produto.altura) : null,
          largura: produto.largura ? Number(produto.largura) : null,
          comprimento: produto.comprimento ? Number(produto.comprimento) : null,
        },
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  const dimensoes = dimensoesDoCarrinho(itemsComProduto)

  // 2) Tenta Melhor Envio
  try {
    const resultados: CotacaoResultado[] = await cotarMelhorEnvio({
      cepDestino: input.cepDestino,
      dimensoes,
      valorTotal: input.valorTotal,
    })

    const opcoes: FreteOpcao[] = resultados
      .filter((r) => r.available && r.price > 0)
      .map((r) => ({
        id: String(r.id),
        nome: r.name,
        transportadora: r.company,
        logo: r.picture,
        preco: r.price,
        prazo: r.deliveryTime,
        fonte: 'melhor-envio' as const,
      }))
      .sort((a, b) => a.preco - b.preco)

    if (opcoes.length > 0) return [...opcoes, opcaoRetirada()]
    // Se vazio, cai pro fallback
  } catch (e) {
    console.warn('[frete] Melhor Envio falhou, usando fallback:', e)
  }

  // 3) Fallback — tabela hardcoded por região
  const fallback = await fallbackFrete(input.cepDestino, dimensoes.peso, input.valorTotal)
  return [
    ...fallback.map((f) => ({
      id: f.codigo,
      nome: f.servico,
      transportadora: 'Correios',
      preco: f.valor,
      prazo: f.prazo,
      fonte: 'fallback' as const,
    })),
    opcaoRetirada(),
  ]
}
