import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  calcularPrecoVitrine,
  MAX_PARCELAS_VITRINE,
  CARTAO_PARCELADO_ATIVO,
} from '../lib/checkout/vitrine-preco'
import { DESCONTO_AVISTA_PERCENTUAL, calcularDescontoAvista } from '../lib/checkout/desconto-avista'

test('o exemplo da loja bate: R$ 1.000 vira R$ 950 no Pix e 6x no cartão', () => {
  const p = calcularPrecoVitrine(1000)
  assert.equal(p.cheio, 1000)
  assert.equal(p.pix, 950)
  assert.equal(p.economiaPix, 50)
  assert.equal(p.parcelas, 6)
  assert.equal(p.valorParcela, 166.67)
})

test('a vitrine promete o mesmo desconto que o checkout cobra', () => {
  // Se a página anunciar um valor e o checkout fechar outro, o cliente desiste
  // no fim do funil — então os dois saem da mesma constante.
  for (const preco of [89.9, 249, 597, 847, 1000, 1899.9]) {
    const vitrine = calcularPrecoVitrine(preco)
    const descontoCheckout = calcularDescontoAvista(preco, 0, 'PIX')
    assert.equal(
      vitrine.pix.toFixed(2),
      (preco - descontoCheckout).toFixed(2),
      `preço no Pix divergente em ${preco}`,
    )
  }
})

test('a soma das parcelas nunca fica abaixo do preço cheio', () => {
  // Arredondar a parcela para baixo faria a loja anunciar menos do que cobra.
  for (const preco of [99.99, 100, 333.33, 999.99, 1000, 1234.56]) {
    const p = calcularPrecoVitrine(preco)
    const soma = Math.round(p.valorParcela * p.parcelas * 100) / 100
    assert.ok(soma >= p.cheio, `${p.parcelas}x de ${p.valorParcela} soma ${soma}, menos que ${p.cheio}`)
    assert.ok(soma - p.cheio < 0.1, `sobra grande demais no arredondamento de ${preco}`)
  }
})

test('preço zero não quebra nem anuncia parcela', () => {
  const p = calcularPrecoVitrine(0)
  assert.equal(p.pix, 0)
  assert.equal(p.economiaPix, 0)
  assert.equal(p.mostrarParcelamento, false)
})

test('parcelamento só é anunciado quando o cartão existe no checkout', () => {
  // Hoje o checkout aceita só Pix. Enquanto MEIOS_PAGAMENTO_CHECKOUT não tiver
  // cartão, a vitrine não pode prometer parcela.
  const desconto = readFileSync('lib/checkout/desconto-avista.ts', 'utf8')
  const temCartaoNoCheckout = /MEIOS_PAGAMENTO_CHECKOUT\s*=\s*\[[^\]]*CREDITO/.test(desconto)

  assert.equal(
    CARTAO_PARCELADO_ATIVO,
    temCartaoNoCheckout,
    'ligue CARTAO_PARCELADO_ATIVO no mesmo deploy em que o cartão entrar no checkout',
  )
  assert.equal(calcularPrecoVitrine(1000).mostrarParcelamento, temCartaoNoCheckout)
})

test('constantes seguem o que a loja combinou', () => {
  assert.equal(DESCONTO_AVISTA_PERCENTUAL, 5)
  assert.equal(MAX_PARCELAS_VITRINE, 6)
})
