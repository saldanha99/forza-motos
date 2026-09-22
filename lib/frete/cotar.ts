/**
 * Função principal de cotação de frete.
 *
 * Estratégia em camadas (degrade gracefully):
 *   1. Tenta Melhor Envio (somente Correios PAC e SEDEX)
 *   2. Se falhar ou não houver serviço disponível, oferece apenas retirada
 *
 * Use SEMPRE este módulo no checkout, nunca chame lib/frete/melhor-envio.ts
 * diretamente.
 */

import { prisma } from '@/lib/prisma'
import {
  cotarMelhorEnvio,
  type CotacaoResultado,
} from './melhor-envio'
import { dimensoesDoCarrinho } from './dimensoes'
import { aplicarFreteGratisSP } from './regras'
import { calcularSubtotalServidor, normalizarItensCotacao } from './cotacao-segura'
import { resumirPreVenda } from '@/lib/checkout/prevenda'

export interface ItemCotacao {
  productId: string
  quantidade: number
}

export class ErroCotacaoFrete extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'ErroCotacaoFrete'
  }
}

export interface FreteOpcao {
  /** ID do serviço com origem preservada. Salve em Order.freteServico. */
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
  /** Parcela do prazo referente à disponibilidade da pré-venda. */
  prazoDisponibilidade?: number
  /** Parcela informada pela transportadora, sem a pré-venda. */
  prazoTransporte?: number
  /** Origem da cotação — útil pra debug */
  fonte: 'melhor-envio' | 'fallback' | 'loja'
}

/** Retirada na loja física — sempre disponível, sem custo */
export function opcaoRetirada(prazoDisponibilidade = 0): FreteOpcao {
  const prazo = Number.isInteger(prazoDisponibilidade) && prazoDisponibilidade > 0
    ? prazoDisponibilidade
    : 0
  return {
    id: 'retirada',
    nome: prazo > 0 ? 'Retirar na loja após disponibilidade' : 'Retirar na loja',
    transportadora: 'R. Funilense, 110 — Campinas/SP',
    preco: 0,
    prazo,
    prazoDisponibilidade: prazo,
    prazoTransporte: 0,
    fonte: 'loja',
  }
}

/** Soma a promessa da pré-venda ao prazo logístico sem perder as parcelas. */
export function somarPrazoDisponibilidade(
  opcoes: FreteOpcao[],
  prazoDisponibilidade: number,
): FreteOpcao[] {
  const disponibilidade = Number.isInteger(prazoDisponibilidade) && prazoDisponibilidade > 0
    ? prazoDisponibilidade
    : 0
  return opcoes.map((opcao) => ({
    ...opcao,
    prazoTransporte: opcao.prazo,
    prazoDisponibilidade: disponibilidade,
    prazo: opcao.prazo + disponibilidade,
  }))
}

/**
 * Cota o frete para o carrinho informado.
 *
 * Retorna lista ordenada pelo menor preço.
 */
export async function cotarFrete(input: {
  cepDestino: string
  items: ItemCotacao[]
}): Promise<FreteOpcao[]> {
  const cepDestino = input.cepDestino.replace(/\D/g, '')
  if (cepDestino.length !== 8) {
    throw new ErroCotacaoFrete('CEP inválido')
  }
  let items: ItemCotacao[]
  try {
    items = normalizarItensCotacao(input.items)
  } catch (error) {
    throw new ErroCotacaoFrete(error instanceof Error ? error.message : 'Carrinho inválido')
  }

  // 1) Busca preço e dimensões no banco. `valorTotal` nunca vem do browser: ele
  // define tanto o seguro quanto a regra promocional de frete grátis.
  const produtos = await prisma.product.findMany({
    where: { id: { in: items.map((i) => i.productId) } },
    select: {
      id: true,
      ativo: true,
      preco: true,
      precoPromocional: true,
      categoria: true,
      peso: true,
      altura: true,
      largura: true,
      comprimento: true,
      preVenda: true,
      prazoEntregaDias: true,
    },
  })

  if (produtos.length !== items.length || produtos.some((produto) => !produto.ativo)) {
    throw new ErroCotacaoFrete('Um ou mais produtos não estão disponíveis')
  }

  const produtosPorId = new Map(produtos.map((produto) => [produto.id, produto]))
  const resumoPreVenda = resumirPreVenda(produtos.map((produto) => ({
    preVenda: produto.preVenda,
    prazoEntregaDias: produto.prazoEntregaDias,
  })))
  const prazoDisponibilidade = resumoPreVenda.prazoMaximoDias ?? 0
  let valorTotal: number
  try {
    valorTotal = calcularSubtotalServidor(
      items,
      produtos.map((produto) => ({
        id: produto.id,
        preco: Number(produto.preco),
        precoPromocional: produto.precoPromocional ? Number(produto.precoPromocional) : null,
      })),
    )
  } catch (error) {
    throw new ErroCotacaoFrete(error instanceof Error ? error.message : 'Preço de produto inválido', 500)
  }

  const itemsComProduto = items
    .map((i) => {
      const produto = produtosPorId.get(i.productId)
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
      cepDestino,
      dimensoes,
      valorTotal,
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
      .slice(0, 4)

    if (opcoes.length > 0) {
      return [
        ...aplicarFreteGratisSP(
          somarPrazoDisponibilidade(opcoes, prazoDisponibilidade),
          cepDestino,
          valorTotal,
        ),
        opcaoRetirada(prazoDisponibilidade),
      ]
    }
    // Sem PAC ou SEDEX real para a rota, oferece apenas retirada.
  } catch (e) {
    console.warn('[frete] Melhor Envio falhou; oferecendo apenas retirada:', e)
  }

  return [opcaoRetirada(prazoDisponibilidade)]
}
