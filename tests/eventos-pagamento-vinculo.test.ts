import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ErroValidacaoPagamentoMP,
  type PagamentoMPNormalizado,
  type PreferenciaMPNormalizada,
} from '../lib/checkout/mercadopago-webhook'
import { vincularPagamentoEvento } from '../lib/eventos/vinculo-pagamento'

const inscricao = { id: 'inscricao-123', total: 5, mpPreferenciaId: 'pref-123' }
const pagamento: PagamentoMPNormalizado = {
  id: 'pagamento-123',
  status: 'approved',
  status_detail: 'accredited',
  external_reference: 'evento_inscricao-123',
  transaction_amount: 5,
  currency_id: 'BRL',
  preference_id: null,
  collector_id: '1845338492',
  payment_method_id: 'master',
  payment_type_id: 'credit_card',
  order_id: 'merchant-order-123',
}
const preferencia: PreferenciaMPNormalizada = {
  id: 'pref-123',
  external_reference: 'evento_inscricao-123',
  collector_id: '1845338492',
  total: 5,
  currency_id: 'BRL',
}

async function comCollector<T>(fn: () => Promise<T>) {
  const anterior = process.env.MERCADOPAGO_COLLECTOR_ID
  process.env.MERCADOPAGO_COLLECTOR_ID = '1845338492'
  try {
    return await fn()
  } finally {
    if (anterior === undefined) delete process.env.MERCADOPAGO_COLLECTOR_ID
    else process.env.MERCADOPAGO_COLLECTOR_ID = anterior
  }
}

test('evento aceita preference_id ausente só após cruzar a preferência oficial persistida', async () => {
  await comCollector(async () => {
    let consultada = ''
    const vinculado = await vincularPagamentoEvento(inscricao, pagamento, {
      consultarPreferencia: async (id) => {
        consultada = id
        return preferencia
      },
    })

    assert.equal(consultada, inscricao.mpPreferenciaId)
    assert.equal(vinculado.preference_id, inscricao.mpPreferenciaId)
    assert.equal(vinculado.id, pagamento.id)
  })
})

test('fallback de evento falha fechado se qualquer âncora financeira divergir', async () => {
  await comCollector(async () => {
    const casos: Array<[Partial<PreferenciaMPNormalizada>, string]> = [
      [{ id: 'outra' }, 'PREFERENCIA_DIVERGENTE'],
      [{ external_reference: 'evento_outra-inscricao' }, 'PREFERENCIA_REFERENCIA_DIVERGENTE'],
      [{ collector_id: '999' }, 'PREFERENCIA_COLLECTOR_DIVERGENTE'],
      [{ currency_id: 'USD' }, 'PREFERENCIA_MOEDA_DIVERGENTE'],
      [{ total: 50 }, 'PREFERENCIA_VALOR_DIVERGENTE'],
    ]

    for (const [alteracao, codigo] of casos) {
      await assert.rejects(
        vincularPagamentoEvento(inscricao, pagamento, {
          consultarPreferencia: async () => ({ ...preferencia, ...alteracao }),
        }),
        (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === codigo,
      )
    }

    await assert.rejects(
      vincularPagamentoEvento(inscricao, { ...pagamento, order_id: null }),
      (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === 'MERCHANT_ORDER_AUSENTE',
    )
    await assert.rejects(
      vincularPagamentoEvento({ ...inscricao, mpPreferenciaId: null }, pagamento),
      (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === 'PREFERENCIA_AUSENTE',
    )
  })
})

test('preference_id direto divergente continua rejeitado sem fallback', async () => {
  await comCollector(async () => {
    let consultou = false
    await assert.rejects(
      vincularPagamentoEvento(inscricao, { ...pagamento, preference_id: 'pref-atacante' }, {
        consultarPreferencia: async () => {
          consultou = true
          return preferencia
        },
      }),
      (error) => error instanceof ErroValidacaoPagamentoMP && error.codigo === 'PREFERENCIA_DIVERGENTE',
    )
    assert.equal(consultou, false)
  })
})
