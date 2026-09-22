export interface ItemPrazoPreVenda {
  preVenda: boolean
  prazoEntregaDias: number | null | undefined
}

export interface ResumoPreVenda {
  preVenda: boolean
  prazoMaximoDias: number | null
}

/** Maior promessa de disponibilidade entre os itens de pré-venda. */
export function resumirPreVenda(itens: ItemPrazoPreVenda[]): ResumoPreVenda {
  const prazos = itens
    .filter((item) => item.preVenda)
    .map((item) => Number(item.prazoEntregaDias))
    .filter((prazo) => Number.isInteger(prazo) && prazo > 0)

  return {
    preVenda: itens.some((item) => item.preVenda),
    prazoMaximoDias: prazos.length ? Math.max(...prazos) : null,
  }
}
