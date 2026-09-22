import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  chaveTentativaCheckoutEvento,
  checkoutTentativaEventoValida,
  lerTentativaCheckoutEvento,
  limparTentativaCheckoutEvento,
  reservaCheckoutEventoAtiva,
  salvarTentativaCheckoutEvento,
  type ArmazenamentoCheckoutEvento,
} from '../lib/eventos/retomada-checkout'

class ArmazenamentoEmMemoria implements ArmazenamentoCheckoutEvento {
  private readonly dados = new Map<string, string>()

  getItem(chave: string) {
    return this.dados.get(chave) ?? null
  }

  setItem(chave: string, valor: string) {
    this.dados.set(chave, valor)
  }

  removeItem(chave: string) {
    this.dados.delete(chave)
  }
}

const TENTATIVA = '67cf8f9f-3f30-4b8e-b636-d8d62cde61be'

test('persiste somente a credencial opaca e isola a tentativa por slug', () => {
  const storage = new ArmazenamentoEmMemoria()
  const agora = Date.UTC(2026, 7, 22, 12)
  salvarTentativaCheckoutEvento(storage, 'curitiba-2026', TENTATIVA, agora)

  assert.deepEqual(lerTentativaCheckoutEvento(storage, 'curitiba-2026', agora + 1_000), {
    versao: 1,
    checkoutTentativaId: TENTATIVA,
    criadaEm: agora,
  })
  assert.equal(lerTentativaCheckoutEvento(storage, 'estrada-real-2026', agora), null)

  const serializado = storage.getItem(chaveTentativaCheckoutEvento('curitiba-2026')) ?? ''
  assert.doesNotMatch(serializado, /nome|email|telefone|cpf|cep|moto|garupa/i)

  limparTentativaCheckoutEvento(storage, 'curitiba-2026')
  assert.equal(lerTentativaCheckoutEvento(storage, 'curitiba-2026', agora), null)
})

test('descarta registros adulterados, inválidos ou antigos', () => {
  const storage = new ArmazenamentoEmMemoria()
  const chave = chaveTentativaCheckoutEvento('curitiba-2026')
  const agora = Date.UTC(2026, 7, 22, 12)

  storage.setItem(chave, '{invalido')
  assert.equal(lerTentativaCheckoutEvento(storage, 'curitiba-2026', agora), null)
  assert.equal(storage.getItem(chave), null)

  storage.setItem(chave, JSON.stringify({ versao: 1, checkoutTentativaId: 'previsivel', criadaEm: agora }))
  assert.equal(lerTentativaCheckoutEvento(storage, 'curitiba-2026', agora), null)

  salvarTentativaCheckoutEvento(storage, 'curitiba-2026', TENTATIVA, agora - 31 * 24 * 60 * 60 * 1_000)
  assert.equal(lerTentativaCheckoutEvento(storage, 'curitiba-2026', agora), null)
  assert.equal(checkoutTentativaEventoValida(TENTATIVA), true)
  assert.equal(checkoutTentativaEventoValida('123'), false)
})

test('só considera retomável uma reserva pendente ainda protegida', () => {
  const agora = new Date('2026-08-22T12:00:00.000Z')
  assert.equal(reservaCheckoutEventoAtiva({
    status: 'PENDENTE',
    reservaExpiraEm: new Date('2026-08-22T12:01:00.000Z'),
    pagamentoResultadoIncerto: false,
  }, agora), true)
  assert.equal(reservaCheckoutEventoAtiva({
    status: 'PENDENTE',
    reservaExpiraEm: new Date('2026-08-22T11:59:00.000Z'),
    pagamentoResultadoIncerto: false,
  }, agora), false)
  assert.equal(reservaCheckoutEventoAtiva({
    status: 'PENDENTE',
    reservaExpiraEm: new Date('2026-08-22T11:59:00.000Z'),
    pagamentoResultadoIncerto: true,
  }, agora), true)
  assert.equal(reservaCheckoutEventoAtiva({
    status: 'PAGO',
    reservaExpiraEm: null,
    pagamentoResultadoIncerto: false,
  }, agora), false)
})

test('cliente persiste antes do POST e a retomada exige slug mais a mesma chave opaca', () => {
  const cliente = readFileSync('components/store/ComprarEventoBtn.tsx', 'utf8')
  const comprar = readFileSync('app/api/eventos/[slug]/comprar/route.ts', 'utf8')
  const retomar = readFileSync('app/api/eventos/[slug]/retomar/route.ts', 'utf8')
  const paginaStatus = readFileSync('app/(store)/eventos/sucesso/page.tsx', 'utf8')

  const salvamento = cliente.indexOf('salvarTentativaCheckoutEvento(window.localStorage')
  const envio = cliente.indexOf('fetch(`/api/eventos/${slug}/comprar`')
  assert.ok(salvamento >= 0 && envio > salvamento)
  assert.match(cliente, /\/api\/eventos\/\$\{slug\}\/retomar/)
  assert.match(cliente, /Retomar pagamento/)
  assert.match(cliente, /Ver status/)

  assert.match(retomar, /where: \{ checkoutTentativaId \}/)
  assert.match(retomar, /inscricao\.evento\.slug !== slug/)
  assert.match(retomar, /checkoutTentativaId\.toLowerCase\(\) !== chaveHeader\.toLowerCase\(\)/)
  assert.doesNotMatch(retomar, /body\.(?:cpf|email|telefone)/)
  assert.match(retomar, /private, no-store/)

  assert.match(comprar, /statusUrl/)
  assert.match(paginaStatus, /if \(inscricao\?\.status === 'PENDENTE'\)/)
  assert.match(paginaStatus, /tentativasPagamento\.length === 0/)
  assert.match(paginaStatus, /Retomar pagamento/)
})
