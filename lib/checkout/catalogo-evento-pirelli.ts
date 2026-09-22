export interface EventoPirelliCheckout {
  id: string
  titulo?: string | null
  ativo: boolean
  publicado: boolean
  vendasAntecipadasAbertas: boolean
  dataInicio: Date | null
  dataFim: Date | null
  valorMinimoPneus?: unknown
  operadorValorMinimoPneus?: 'MAIOR_QUE' | 'MAIOR_OU_IGUAL'
  limiteNomeGravacao?: number
}

export interface ItemCarrinhoEventoPirelli {
  productId: string
  quantidade: number
  produto: {
    preVenda: boolean
    prazoEntregaDias: number | null
    eventoPirelliId: string | null
    limitePorPedidoEvento: number | null
    eventoPirelli: EventoPirelliCheckout | null
  }
}

export interface CarrinhoEventoPirelli {
  eventoId: string
  evento: EventoPirelliCheckout
}

export function validarDisponibilidadeEventoPirelli(
  evento: EventoPirelliCheckout | null,
  agora = new Date(),
): EventoPirelliCheckout {
  if (!evento || !evento.ativo || !evento.publicado) {
    throw new Error('EVENTO_PIRELLI_INDISPONIVEL')
  }
  if (
    evento.dataInicio &&
    agora < evento.dataInicio &&
    !evento.vendasAntecipadasAbertas
  ) {
    throw new Error('EVENTO_PIRELLI_FORA_DA_JANELA')
  }
  if (evento.dataFim && agora > evento.dataFim) {
    throw new Error('EVENTO_PIRELLI_FORA_DA_JANELA')
  }
  return evento
}

/** Versão booleana para páginas públicas; o checkout continua usando os erros explícitos. */
export function vendasEventoPirelliDisponiveis(
  evento: EventoPirelliCheckout | null,
  agora = new Date(),
) {
  try {
    validarDisponibilidadeEventoPirelli(evento, agora)
    return true
  } catch {
    return false
  }
}

/**
 * Classifica a origem do carrinho apenas com dados lidos do banco.
 *
 * O browser não escolhe o canal nem envia o ID da campanha. Isso impede que
 * um checkout comum seja marcado como evento (ou o inverso) para contornar
 * estoque, limites comerciais ou a janela de venda.
 */
export function classificarCarrinhoEventoPirelli(
  itens: ItemCarrinhoEventoPirelli[],
  agora = new Date(),
): CarrinhoEventoPirelli | null {
  const idsEvento = new Set(
    itens
      .map((item) => item.produto.eventoPirelliId)
      .filter((id): id is string => Boolean(id)),
  )

  if (idsEvento.size === 0) return null
  if (idsEvento.size !== 1 || itens.some((item) => !item.produto.eventoPirelliId)) {
    throw new Error('CARRINHO_EVENTO_MISTO')
  }

  const eventoId = Array.from(idsEvento)[0]
  const evento = itens[0]?.produto.eventoPirelli
  if (!evento || evento.id !== eventoId) throw new Error('EVENTO_PIRELLI_INDISPONIVEL')
  validarDisponibilidadeEventoPirelli(evento, agora)

  for (const item of itens) {
    const produto = item.produto
    if (
      produto.eventoPirelliId !== eventoId ||
      produto.eventoPirelli?.id !== eventoId
    ) {
      throw new Error('CARRINHO_EVENTO_MISTO')
    }
    // A campanha é sempre pré-venda. A validação também protege bancos que
    // ainda estejam no intervalo entre deploy da aplicação e da constraint.
    if (
      !produto.preVenda ||
      !Number.isInteger(produto.prazoEntregaDias) ||
      Number(produto.prazoEntregaDias) <= 0
    ) {
      throw new Error('PRODUTO_EVENTO_INVALIDO')
    }
    if (
      produto.limitePorPedidoEvento !== null &&
      item.quantidade > produto.limitePorPedidoEvento
    ) {
      throw new Error('LIMITE_PRODUTO_EVENTO_EXCEDIDO')
    }
  }

  return { eventoId, evento }
}
