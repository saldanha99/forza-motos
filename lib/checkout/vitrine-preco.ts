/**
 * Preço como a vitrine anuncia: valor no Pix (com o desconto à vista) e, quando
 * a loja aceitar cartão, o parcelamento sobre o preço cheio.
 *
 * A conta é a mesma do checkout — ver lib/checkout/desconto-avista.ts. Duplicar
 * o percentual aqui faria a página prometer um valor e a finalização cobrar
 * outro.
 */
import { DESCONTO_AVISTA_PERCENTUAL } from './desconto-avista'

/** Parcelamento máximo anunciado na vitrine. */
export const MAX_PARCELAS_VITRINE = 6

/**
 * A ficha do produto anuncia o parcelamento em 6x — pedido da loja, que vende
 * no cartão em 6x sem juros no balcão e pelo WhatsApp.
 *
 * ATENÇÃO: o checkout online ainda fecha só no Pix (MEIOS_PAGAMENTO_CHECKOUT).
 * Por isso a ficha é obrigada a dizer ONDE o cartão é aceito — ver
 * `CARTAO_ONDE_PARCELA`. Prometer 6x e o cliente achar só Pix no fim do funil
 * seria pior do que não falar nada. Quando o cartão entrar no checkout, apague
 * essa ressalva no mesmo deploy.
 */
export const CARTAO_PARCELADO_ATIVO = true

/** Onde o cliente paga no cartão hoje — aparece junto da parcela. */
export const CARTAO_ONDE_PARCELA = 'na loja ou pelo WhatsApp'

export interface PrecoVitrine {
  /** Preço cheio — é o que o cartão parcela */
  cheio: number
  /** Preço à vista no Pix */
  pix: number
  /** Quanto o cliente economiza pagando no Pix */
  economiaPix: number
  parcelas: number
  /** Valor de cada parcela, em cima do preço cheio */
  valorParcela: number
  /** Só anuncia parcelamento quando o cartão existe de verdade no checkout */
  mostrarParcelamento: boolean
}

function emCentavos(valor: number): number {
  return Math.max(0, Math.round(Number(valor) * 100))
}

export function calcularPrecoVitrine(
  precoCheio: number,
  parcelas: number = MAX_PARCELAS_VITRINE,
): PrecoVitrine {
  const cheioCentavos = emCentavos(precoCheio)
  const descontoCentavos = Math.round(cheioCentavos * (DESCONTO_AVISTA_PERCENTUAL / 100))
  const pixCentavos = cheioCentavos - descontoCentavos

  const vezes = Math.max(1, Math.trunc(parcelas))
  // Arredonda a parcela para cima no centavo: somar 6 parcelas não pode dar
  // menos que o preço cheio.
  const parcelaCentavos = Math.ceil(cheioCentavos / vezes)

  return {
    cheio: cheioCentavos / 100,
    pix: pixCentavos / 100,
    economiaPix: descontoCentavos / 100,
    parcelas: vezes,
    valorParcela: parcelaCentavos / 100,
    mostrarParcelamento: CARTAO_PARCELADO_ATIVO && cheioCentavos > 0,
  }
}
