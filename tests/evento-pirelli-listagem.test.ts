import assert from 'node:assert/strict'
import test from 'node:test'
import { eventoPirelliParaListagem } from '../lib/eventos/listagem-pirelli'

const eventoBase = {
  id: 'evento-1',
  titulo: 'Evento Pirelli + Forza Motos',
  descricao: null,
  dataInicio: new Date('2026-09-05T14:00:00.000Z'),
  dataFim: new Date('2026-09-07T02:59:59.999Z'),
  local: 'Lucky Friends Arena',
  ativo: true,
  publicado: true,
  exibirNaHome: false,
  exibirEmEventos: false,
}

test('controles da home e do calendário são independentes', () => {
  const somenteHome = { ...eventoBase, exibirNaHome: true }
  const itemHome = eventoPirelliParaListagem(somenteHome, 'home', new Date('2026-08-12T12:00:00.000Z'))
  assert.equal(itemHome?.etiquetaPreco, 'Ação especial')
  assert.equal(eventoPirelliParaListagem(somenteHome, 'eventos'), null)

  const somenteEventos = { ...eventoBase, exibirEmEventos: true }
  assert.equal(eventoPirelliParaListagem(somenteEventos, 'home', new Date('2026-08-12T12:00:00.000Z')), null)
  assert.ok(eventoPirelliParaListagem(somenteEventos, 'eventos'))
})

test('evento precisa estar ativo, publicado e com data para aparecer', () => {
  const visivel = { ...eventoBase, exibirNaHome: true, exibirEmEventos: true }
  assert.equal(eventoPirelliParaListagem({ ...visivel, ativo: false }, 'eventos'), null)
  assert.equal(eventoPirelliParaListagem({ ...visivel, publicado: false }, 'eventos'), null)
  assert.equal(eventoPirelliParaListagem({ ...visivel, dataInicio: null }, 'eventos'), null)
})

test('home mantém evento em andamento e remove evento encerrado', () => {
  const visivel = { ...eventoBase, exibirNaHome: true }
  assert.ok(eventoPirelliParaListagem(visivel, 'home', new Date('2026-09-06T12:00:00.000Z')))
  assert.equal(eventoPirelliParaListagem(visivel, 'home', new Date('2026-09-08T12:00:00.000Z')), null)
})
