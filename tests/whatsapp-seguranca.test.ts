import assert from 'node:assert/strict'
import test from 'node:test'
import {
  solicitouOptOutWhatsapp,
  statusConfirmadoEvolution,
} from '../lib/evolution/webhook-seguranca'

test('somente ACK real confirma entrega ou leitura no WhatsApp', () => {
  assert.equal(statusConfirmadoEvolution({ status: 1 }), null)
  assert.equal(statusConfirmadoEvolution({ status: 2 }), null)
  assert.equal(statusConfirmadoEvolution({ status: 3 }), 'ENTREGUE')
  assert.equal(statusConfirmadoEvolution({ status: 4 }), 'LIDA')
  assert.equal(statusConfirmadoEvolution({ status: 5 }), 'LIDA')
  assert.equal(statusConfirmadoEvolution({ update: { status: 'DELIVERY_ACK' } }), 'ENTREGUE')
})

test('PARE e SAIR cancelam automações sem falso positivo em uma conversa comum', () => {
  assert.equal(solicitouOptOutWhatsapp('PARE'), true)
  assert.equal(solicitouOptOutWhatsapp('não quero mais'), true)
  assert.equal(solicitouOptOutWhatsapp('Sair!'), true)
  assert.equal(solicitouOptOutWhatsapp('Pode separar o pedido para mim?'), false)
  assert.equal(solicitouOptOutWhatsapp('Quero cancelar só este pedido'), false)
})
