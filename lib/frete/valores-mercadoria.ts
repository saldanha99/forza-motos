export interface MercadoriaBruta {
  nome: string
  quantidade: number
  valorUnitario: number
}

export interface MercadoriasLiquidas {
  produtos: MercadoriaBruta[]
  valorTotal: number
}

const emCentavos = (valor: number) => Math.round(valor * 100)

/**
 * Rateia o desconto do pedido entre as unidades enviadas.
 *
 * O Melhor Envio recebe os produtos e o valor segurado. Ambos precisam
 * representar o total líquido da NF-e/pagamento, inclusive desconto Pix.
 * O rateio pelo maior resto mantém a soma exata até o último centavo.
 */
export function calcularMercadoriasLiquidas(input: {
  produtos: MercadoriaBruta[]
  subtotal: number
  desconto: number
}): MercadoriasLiquidas {
  const unidades = input.produtos.flatMap((produto) => {
    const quantidade = Number(produto.quantidade)
    const valorCentavos = emCentavos(Number(produto.valorUnitario))
    if (!Number.isInteger(quantidade) || quantidade <= 0 || valorCentavos <= 0) {
      throw new Error('Produto com quantidade ou valor inválido para o Melhor Envio')
    }
    return Array.from({ length: quantidade }, () => ({
      nome: produto.nome,
      valorBrutoCentavos: valorCentavos,
    }))
  })

  if (unidades.length === 0) throw new Error('Pedido sem produtos para o Melhor Envio')

  const brutoProdutos = unidades.reduce((total, unidade) => total + unidade.valorBrutoCentavos, 0)
  const subtotalInformado = Number(input.subtotal)
  const descontoInformado = Number(input.desconto)
  if (!Number.isFinite(subtotalInformado) || !Number.isFinite(descontoInformado) || descontoInformado < 0) {
    throw new Error('Subtotal ou desconto inválido para o Melhor Envio')
  }
  const subtotal = emCentavos(subtotalInformado)
  const desconto = emCentavos(descontoInformado)
  if (brutoProdutos !== subtotal) {
    throw new Error('Subtotal do pedido diverge dos produtos; revise os valores antes de gerar a etiqueta')
  }

  const totalLiquido = Math.max(0, brutoProdutos - desconto)
  if (totalLiquido < unidades.length) {
    throw new Error('Valor líquido precisa ser de pelo menos R$ 0,01 por unidade enviada')
  }

  const rateadas = unidades.map((unidade, indice) => {
    const exato = unidade.valorBrutoCentavos * totalLiquido / brutoProdutos
    const base = Math.floor(exato)
    return { ...unidade, indice, valorLiquidoCentavos: base, resto: exato - base }
  })
  let centavosRestantes = totalLiquido - rateadas.reduce(
    (total, unidade) => total + unidade.valorLiquidoCentavos,
    0,
  )

  for (const unidade of [...rateadas].sort((a, b) => b.resto - a.resto || a.indice - b.indice)) {
    if (centavosRestantes <= 0) break
    unidade.valorLiquidoCentavos++
    centavosRestantes--
  }

  // Um item muito barato poderia receber zero no rateio proporcional. Como a
  // API exige valor comercial positivo por unidade, transfere um centavo de
  // unidades com saldo sem alterar o total líquido.
  for (const unidade of rateadas.filter((item) => item.valorLiquidoCentavos === 0)) {
    const doador = [...rateadas]
      .sort((a, b) => b.valorLiquidoCentavos - a.valorLiquidoCentavos)
      .find((item) => item.valorLiquidoCentavos > 1)
    if (!doador) {
      throw new Error('Não foi possível ratear o desconto com valor positivo em todos os produtos')
    }
    doador.valorLiquidoCentavos--
    unidade.valorLiquidoCentavos++
  }

  const agrupadas = new Map<string, MercadoriaBruta>()
  for (const unidade of rateadas) {
    const chave = `${unidade.nome}\u0000${unidade.valorLiquidoCentavos}`
    const existente = agrupadas.get(chave)
    if (existente) {
      existente.quantidade++
    } else {
      agrupadas.set(chave, {
        nome: unidade.nome,
        quantidade: 1,
        valorUnitario: unidade.valorLiquidoCentavos / 100,
      })
    }
  }

  return {
    produtos: [...agrupadas.values()],
    valorTotal: totalLiquido / 100,
  }
}
