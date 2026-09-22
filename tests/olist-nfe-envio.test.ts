import assert from 'node:assert/strict'
import test from 'node:test'
import {
  interpretarEventoLogisticaOlist,
  interpretarNotaFiscalOlist,
  interpretarPedidoOlistFiscal,
  normalizarSituacaoOlist,
  statusInternoDaSituacaoOlist,
} from '../lib/olist/nfe-envio-core'

const CHAVE_FIXTURE = '35260800857031000163550010000032281433790697'

test('interpreta o formato real do webhook de atualização de pedido', () => {
  const evento = interpretarEventoLogisticaOlist({
    versao: '1.0.1',
    tipo: 'atualizacao_pedido',
    dados: {
      id: '943378719',
      numero: '7306',
      idPedidoEcommerce: 'FM-TESTE-0001',
      codigoSituacao: 'faturado',
      descricaoSituacao: 'Faturado',
      idNotaFiscal: '943379069',
    },
  })

  assert.deepEqual(evento, {
    tipo: 'atualizacao_pedido',
    olistOrderId: '943378719',
    situacao: 'faturado',
    statusInterno: 'SEPARANDO',
    idNotaFiscal: '943379069',
  })
})

test('interpreta o webhook fiscal real mesmo sem idPedidoEcommerce', () => {
  const evento = interpretarEventoLogisticaOlist({
    versao: '1.0.1',
    tipo: 'nota_fiscal',
    dados: {
      chaveAcesso: CHAVE_FIXTURE,
      numero: 3228,
      serie: '1',
      valorNota: 12.88,
      idNotaFiscalTiny: '943379069',
    },
  })

  assert.deepEqual(evento, {
    tipo: 'nota_fiscal',
    idNotaFiscal: '943379069',
    chaveAcesso: CHAVE_FIXTURE,
  })
})

test('só considera autorizada a situação fiscal 6', () => {
  const base = {
    retorno: {
      nota_fiscal: {
        id: '943379069',
        id_venda: '943378719',
        numero_ecommerce: 'FM-TESTE-0001',
        chave_acesso: CHAVE_FIXTURE,
        valor_nota: '12,88',
      },
    },
  }

  const autorizada = interpretarNotaFiscalOlist({
    retorno: { nota_fiscal: { ...base.retorno.nota_fiscal, situacao: '6' } },
  })
  assert.deepEqual(autorizada, {
    id: '943379069',
    idVenda: '943378719',
    numeroEcommerce: 'FM-TESTE-0001',
    chaveAcesso: CHAVE_FIXTURE,
    valorNota: 12.88,
    situacao: '6',
    autorizada: true,
  })

  for (const situacao of ['1', '2', '3', '5', '7', '9', '10']) {
    const nota = interpretarNotaFiscalOlist({
      retorno: { nota_fiscal: { ...base.retorno.nota_fiscal, situacao } },
    })
    assert.equal(nota?.autorizada, false, `situação ${situacao} não pode liberar envio`)
  }
})

test('reconciliação extrai a NF-e vinculada do pedido da Olist', () => {
  assert.deepEqual(interpretarPedidoOlistFiscal({
    retorno: {
      pedido: {
        id: '943378719',
        situacao: 'Faturado',
        id_nota_fiscal: '943379069',
      },
    },
  }), {
    id: '943378719',
    situacao: 'Faturado',
    idNotaFiscal: '943379069',
  })

  assert.equal(interpretarPedidoOlistFiscal({ retorno: { status: 'OK' } }), null)
})

test('normaliza os estados portugueses e em snake_case sem regredir o pedido', () => {
  assert.equal(normalizarSituacaoOlist('Preparando_Envio'), 'preparando envio')
  assert.equal(statusInternoDaSituacaoOlist('Preparando_Envio'), 'SEPARANDO')
  assert.equal(statusInternoDaSituacaoOlist('Em separação'), 'SEPARANDO')
  assert.equal(statusInternoDaSituacaoOlist('Faturado'), 'SEPARANDO')
  assert.equal(statusInternoDaSituacaoOlist('Entregue'), 'ENTREGUE')
  assert.equal(statusInternoDaSituacaoOlist('estado desconhecido'), null)
})
