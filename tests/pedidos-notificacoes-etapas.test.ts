import assert from 'node:assert/strict'
import test from 'node:test'
import { resolverContatoNotificacaoPedido } from '../lib/checkout/notificacoes-etapas-pedido'

test('notificações usam o contato confirmado no checkout antes dos dados antigos da conta', () => {
  const contato = resolverContatoNotificacaoPedido(
    {
      nome: 'Cliente da compra',
      email: 'Novo.Email@Example.com',
      telefone: '(19) 99999-1111',
    },
    {
      nome: 'Nome antigo',
      email: 'antigo@example.com',
      telefone: '(19) 98888-2222',
    },
  )

  assert.deepEqual(contato, {
    nomeCliente: 'Cliente da compra',
    email: 'novo.email@example.com',
    whatsapp: '5519999991111',
  })
})

test('notificações recorrem à conta quando o checkout não tem contato válido', () => {
  const contato = resolverContatoNotificacaoPedido(
    { email: 'inválido', telefone: '' },
    {
      nome: 'Cliente',
      email: 'conta@example.com',
      telefone: '19988882222',
    },
  )

  assert.deepEqual(contato, {
    nomeCliente: 'Cliente',
    email: 'conta@example.com',
    // Campo vazio no snapshot não deve apagar um contato válido da conta.
    whatsapp: '5519988882222',
  })
})
