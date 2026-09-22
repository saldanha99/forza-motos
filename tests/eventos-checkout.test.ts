import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  DURACAO_RESERVA_EVENTO_MINUTOS,
  EventoCheckoutError,
  normalizarCheckoutEvento,
  validarIdempotencyKey,
  validarPagamentoEvento,
} from '../lib/eventos/checkout'

assert.ok(DURACAO_RESERVA_EVENTO_MINUTOS >= 120)

const evento = {
  preco: 597,
  opcoesVaga: [
    { label: 'Piloto solo', preco: 597 },
    { label: 'Piloto + garupa', preco: 847 },
  ],
}

const eventoComQuartosNoPreco = {
  preco: 597,
  opcoesVaga: [
    {
      label: 'Quarto Compartilhado - Valor para uma pessoa em quarto duplo dividido com outro participante',
      preco: 597,
    },
    {
      label: 'Quarto Individual ou Casal - Valor para uma pessoa ou casal',
      preco: 847,
    },
  ],
}

const entradaBase = {
  nome: 'Cliente de Teste',
  email: 'CLIENTE@EXAMPLE.COM',
  telefone: '(19) 99999-9999',
  cpf: '191.191.191-00',
  cep: '13073-041',
  numeroResidencia: '120',
  motoModelo: 'BMW R 1250 GS',
  temGarupa: false,
  nomeGarupa: '',
  tipoAcomodacao: 'Quarto Compartilhado',
  opcaoVagaLabel: 'Piloto solo',
  quantidade: 999,
  preco: 0.01,
}

function deveFalhar(fn: () => unknown, code?: string) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof EventoCheckoutError)
    if (code) assert.equal(error.code, code)
    return true
  })
}

{
  const checkout = normalizarCheckoutEvento(evento, entradaBase)
  assert.equal(checkout.email, 'cliente@example.com')
  assert.equal(checkout.telefone, '19999999999')
  assert.equal(checkout.quantidadeVagas, 1)
  assert.equal(checkout.total, 597)
  assert.equal(checkout.opcaoVaga?.label, 'Piloto solo')
}

{
  const checkout = normalizarCheckoutEvento(evento, {
    ...entradaBase,
    temGarupa: true,
    nomeGarupa: 'Garupa de Teste',
    tipoAcomodacao: 'valor manipulado',
    opcaoVagaLabel: 'Piloto + garupa',
  })
  assert.equal(checkout.quantidadeVagas, 2)
  assert.equal(checkout.total, 847)
  assert.equal(checkout.tipoAcomodacao, 'Quarto Casal')
}

{
  const checkout = normalizarCheckoutEvento(eventoComQuartosNoPreco, {
    ...entradaBase,
    tipoAcomodacao: 'Quarto Single / Casal (Individual)',
    opcaoVagaLabel: eventoComQuartosNoPreco.opcoesVaga[0].label,
  })
  assert.equal(checkout.total, 597)
  assert.equal(checkout.quantidadeVagas, 1)
  assert.equal(checkout.tipoAcomodacao, 'Quarto Compartilhado')
}

{
  const checkout = normalizarCheckoutEvento(eventoComQuartosNoPreco, {
    ...entradaBase,
    tipoAcomodacao: 'Quarto Compartilhado',
    opcaoVagaLabel: eventoComQuartosNoPreco.opcoesVaga[1].label,
  })
  assert.equal(checkout.total, 847)
  assert.equal(checkout.quantidadeVagas, 1)
  assert.equal(checkout.tipoAcomodacao, 'Quarto Single / Casal (Individual)')
}

{
  const checkout = normalizarCheckoutEvento(eventoComQuartosNoPreco, {
    ...entradaBase,
    temGarupa: true,
    nomeGarupa: 'Garupa de Teste',
    tipoAcomodacao: 'Quarto Compartilhado',
    opcaoVagaLabel: eventoComQuartosNoPreco.opcoesVaga[1].label,
  })
  assert.equal(checkout.total, 847)
  assert.equal(checkout.quantidadeVagas, 2)
  assert.equal(checkout.tipoAcomodacao, 'Quarto Casal')
}

deveFalhar(() => normalizarCheckoutEvento(eventoComQuartosNoPreco, {
  ...entradaBase,
  temGarupa: true,
  nomeGarupa: 'Garupa de Teste',
  opcaoVagaLabel: eventoComQuartosNoPreco.opcoesVaga[0].label,
}))

{
  const checkout = normalizarCheckoutEvento(
    { preco: 100, opcoesVaga: [] },
    {
      ...entradaBase,
      temGarupa: true,
      nomeGarupa: 'Garupa de Teste',
      opcaoVagaLabel: undefined,
    },
  )
  assert.equal(checkout.quantidadeVagas, 2)
  assert.equal(checkout.total, 200)
}

{
  const gratuito = normalizarCheckoutEvento(
    { preco: 0, opcoesVaga: [] },
    {
      ...entradaBase,
      cpf: '',
      cep: '',
      numeroResidencia: '',
      tipoAcomodacao: null,
      opcaoVagaLabel: undefined,
    },
  )
  assert.equal(gratuito.total, 0)
  assert.equal(gratuito.cpf, null)
}

{
  const grupo = normalizarCheckoutEvento(
    { preco: 100, opcoesVaga: [{ label: 'Pacote 4 pessoas', preco: 320 }] },
    { ...entradaBase, opcaoVagaLabel: 'Pacote 4 pessoas' },
  )
  assert.equal(grupo.quantidadeVagas, 4)
  assert.equal(grupo.total, 320)
}

deveFalhar(() => normalizarCheckoutEvento(evento, {
  ...entradaBase,
  temGarupa: true,
  nomeGarupa: 'Garupa de Teste',
  opcaoVagaLabel: 'Piloto solo',
}))
deveFalhar(() => normalizarCheckoutEvento(evento, { ...entradaBase, cpf: '111.111.111-11' }))
deveFalhar(() => normalizarCheckoutEvento(evento, { ...entradaBase, cep: '1234' }))
deveFalhar(() => normalizarCheckoutEvento(evento, { ...entradaBase, email: 'email-invalido' }))
deveFalhar(
  () => normalizarCheckoutEvento({ preco: 100, opcoesVaga: null }, entradaBase),
  'evento_configuracao_invalida',
)

{
  const key = '67cf8f9f-3f30-4b8e-b636-d8d62cde61be'
  assert.equal(validarIdempotencyKey(key, key), key)
  deveFalhar(() => validarIdempotencyKey(key, '5dfe0219-73d4-41cd-a53a-a382e827c4c0'), 'idempotency_key_invalida')
}

const inscricao = {
  id: 'cm123',
  total: 847,
  status: 'PENDENTE' as const,
  mpPreferenciaId: 'pref-123',
  mpPagamentoId: null,
  mpStatus: 'pending',
  reservaExpiraEm: new Date('2026-08-10T18:30:00.000Z'),
}
const pagamento = {
  id: 'pay-123',
  status: 'approved',
  external_reference: 'evento_cm123',
  transaction_amount: 847,
  currency_id: 'BRL',
  preference_id: 'pref-123',
}
const duranteReserva = new Date('2026-08-10T18:00:00.000Z')

{
  const decisao = validarPagamentoEvento(inscricao, pagamento, duranteReserva)
  assert.equal(decisao.statusInscricao, 'PAGO')
  assert.equal(decisao.notificarAprovacao, true)
  assert.equal(decisao.reembolsoNecessario, false)
}

{
  const decisao = validarPagamentoEvento(inscricao, { ...pagamento, status: 'rejected' }, duranteReserva)
  assert.equal(decisao.statusInscricao, 'PENDENTE')
  assert.equal(decisao.liberarReserva, false)
}

{
  const depoisDoPrazo = new Date('2026-08-10T19:00:00.000Z')
  const pendente = validarPagamentoEvento(
    inscricao,
    { ...pagamento, status: 'pending' },
    depoisDoPrazo,
  )
  assert.equal(pendente.statusInscricao, 'PENDENTE')
  assert.equal(pendente.liberarReserva, false)

  const rejeitado = validarPagamentoEvento(
    inscricao,
    { ...pagamento, status: 'rejected' },
    depoisDoPrazo,
  )
  assert.equal(rejeitado.statusInscricao, 'CANCELADO')
  assert.equal(rejeitado.liberarReserva, true)
}

{
  const decisao = validarPagamentoEvento(
    { ...inscricao, status: 'CANCELADO', reservaExpiraEm: null },
    { ...pagamento, status: 'pending' },
    duranteReserva,
  )
  assert.equal(decisao.statusInscricao, 'CANCELADO')
  assert.equal(decisao.alterou, false)
}

{
  const decisao = validarPagamentoEvento(
    { ...inscricao, status: 'PAGO', mpPagamentoId: 'pay-123', mpStatus: 'approved' },
    { ...pagamento, status: 'in_mediation' },
    duranteReserva,
  )
  assert.equal(decisao.statusInscricao, 'PAGO')
  assert.equal(decisao.alterou, false)
}

{
  const decisao = validarPagamentoEvento(
    { ...inscricao, status: 'PAGO', mpPagamentoId: 'pay-original' },
    { ...pagamento, id: 'pay-duplicado' },
    duranteReserva,
  )
  assert.equal(decisao.statusInscricao, 'PAGO')
  assert.equal(decisao.reembolsoNecessario, true)
  assert.equal(decisao.notificarAprovacao, false)
}

{
  const decisao = validarPagamentoEvento(inscricao, pagamento, new Date('2026-08-10T19:00:00.000Z'))
  // Se a inscrição ainda está PENDENTE sob o lock do evento, a aprovação
  // vence a corrida. Se a expiração já venceu, o estado será CANCELADO e o
  // caso de teste abaixo exige estorno.
  assert.equal(decisao.statusInscricao, 'PAGO')
  assert.equal(decisao.reembolsoNecessario, false)
}

{
  const decisao = validarPagamentoEvento(
    { ...inscricao, status: 'PAGO', mpPagamentoId: 'pay-123' },
    { ...pagamento, status: 'refunded' },
    duranteReserva,
  )
  assert.equal(decisao.statusInscricao, 'CANCELADO')
  assert.equal(decisao.liberarReserva, true)
}

{
  const decisao = validarPagamentoEvento(
    { ...inscricao, status: 'PAGO', mpPagamentoId: 'pay-original' },
    { ...pagamento, id: 'pay-secundario', status: 'refunded' },
    duranteReserva,
  )
  assert.equal(decisao.statusInscricao, 'PAGO')
  assert.equal(decisao.alterou, false)
}

{
  const decisao = validarPagamentoEvento(
    { ...inscricao, status: 'CANCELADO', reservaExpiraEm: null },
    pagamento,
    duranteReserva,
  )
  assert.equal(decisao.statusInscricao, 'CANCELADO')
  assert.equal(decisao.reembolsoNecessario, true)
}

deveFalhar(
  () => validarPagamentoEvento(inscricao, { ...pagamento, transaction_amount: 8.47 }, duranteReserva),
  'pagamento_valor_divergente',
)
deveFalhar(
  () => validarPagamentoEvento(inscricao, { ...pagamento, currency_id: 'USD' }, duranteReserva),
  'pagamento_moeda_divergente',
)
deveFalhar(
  () => validarPagamentoEvento(inscricao, { ...pagamento, preference_id: 'outra' }, duranteReserva),
  'pagamento_preferencia_divergente',
)
deveFalhar(
  () => validarPagamentoEvento(inscricao, { ...pagamento, transaction_amount: null }, duranteReserva),
  'pagamento_valor_divergente',
)
deveFalhar(
  () => validarPagamentoEvento(inscricao, { ...pagamento, status: 'status-inventado' }, duranteReserva),
  'pagamento_status_invalido',
)

{
  const lock = readFileSync('lib/eventos/lock.ts', 'utf8')
  assert.match(lock, /SELECT true AS locked/)
  assert.doesNotMatch(lock, /SELECT\s+pg_advisory_xact_lock/)
}

console.log('eventos-checkout: testes concluídos com sucesso')
