import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { sugerirClassificacao, REGRAS_LINHA } from '../lib/pneus/sugestao'

/** Nomes reais do catálogo em 22/09/2026 — a sugestão precisa acertar estes. */
const CATALOGO_REAL: [string, string, string][] = [
  ['PNEU PIRELLI SCORPION RALLY STR 150/70R17 69V', 'big-trail', 'Scorpion Rally STR'],
  ['PNEU PIRELLI SCORPION TRAIL II 120/70R19 TL 60V', 'big-trail', 'Scorpion Trail II'],
  ['PNEU METZELER TOURANCE NEXT II 90/90-21', 'big-trail', 'Tourance Next II'],
  ['PNEU METZELER TOURANCE 100/90-19 57H', 'big-trail', 'Tourance'],
  ['PNEU MICHELIN ANAKEE ROAD 110/80R19 59V', 'big-trail', 'Anakee Road'],
  ['PNEU DUNLOP TRAILMAX MIXTOUR 120/70R19 60V', 'big-trail', 'Trailmax Mixtour'],
  ['PNEU DUNLOP TRAILMAX D609 120/70R17 58W TL', 'big-trail', 'Trailmax'],
  ['PAR PNEUS MITAS ENDURO TRAIL+ E-07+ 90/90-21 + 150/70B17', 'big-trail', 'Enduro Trail+ E-07+'],
  ['PNEU PIRELLI ANGEL GT 120/70R17 58W', 'esportivo-street', 'Angel GT'],
  ['PNEU PIRELLI ANGEL ST 160/60R17 69W', 'esportivo-street', 'Angel ST'],
  ['PNEU PIRELLI DIABLO ROSSO IV CORSA 120/70R17 58W', 'esportivo-street', 'Diablo Rosso IV Corsa'],
  ['PNEU PIRELLI DIABLO ROSSO III 180/55R17 73W', 'esportivo-street', 'Diablo Rosso III'],
  ['PNEU PIRELLI DIABLO ROSSO II 140/70R17 66H', 'esportivo-street', 'Diablo Rosso II'],
  ['PNEU PIRELLI DIABLO SUPERCORSA SPV2 190/50R17 TL (73W)', 'esportivo-street', 'Diablo Supercorsa'],
  ['PNEU PIRELLI SPORT DEMON 110/70-17 54H', 'esportivo-street', 'Sport Demon'],
  ['PNEU METZELER SPORTEC M9RR 140/70R17 TL 66H', 'esportivo-street', 'Sportec M9RR'],
  ['PNEU METZELER SPORTEC M3 120/70R17 (58W)', 'esportivo-street', 'Sportec M3'],
  ['PNEU METZELER ME STREET 90/90-18 TL 57P', 'esportivo-street', 'ME Street'],
  ['PNEU METZELER CRUISETEC 130/90B16 TL 73H', 'custom', 'Cruisetec'],
  ['PNEU METZELER MARATHON ME888 180/55B18 TL 80H', 'custom', 'Marathon ME888'],
  ['PNEU MICHELIN SCORCHER 11 240/40R18', 'custom', 'Scorcher'],
  ['PNEU MICHELIN CITY GRIP 2 140/70-14', 'scooter', 'City Grip 2'],
  // O combo do evento traz "ROSSO III" sem o "DIABLO" e com brinde no nome.
  ['PNEU PIRELLI ROSSO III 150/60R17 + CANECA TÉRMICA 700ML', 'esportivo-street', 'Diablo Rosso III'],
]

test('a sugestão acerta o catálogo real da loja', () => {
  for (const [nome, segmento, linha] of CATALOGO_REAL) {
    const sugestao = sugerirClassificacao(nome)
    assert.ok(sugestao, `sem sugestão para "${nome}"`)
    assert.equal(sugestao.segmento, segmento, `segmento errado em "${nome}"`)
    assert.equal(sugestao.linha, linha, `linha errada em "${nome}"`)
  }
})

test('vence o termo mais longo, não o primeiro que casar', () => {
  // "diablo rosso iv corsa" contém "diablo rosso"; sem essa regra a linha
  // específica se perderia na genérica.
  assert.equal(sugerirClassificacao('DIABLO ROSSO IV CORSA 120/70R17')?.linha, 'Diablo Rosso IV Corsa')
  assert.equal(sugerirClassificacao('SCORPION RALLY STR 90/90-21')?.linha, 'Scorpion Rally STR')
  assert.equal(sugerirClassificacao('TOURANCE NEXT II 90/90-21')?.linha, 'Tourance Next II')
  assert.equal(sugerirClassificacao('CITY GRIP 2 140/70-14')?.linha, 'City Grip 2')
})

test('acento e caixa não atrapalham', () => {
  assert.equal(sugerirClassificacao('pneu pirelli ângel gt 120/70r17')?.linha, 'Angel GT')
  assert.equal(sugerirClassificacao('PNEU  PIRELLI   ANGEL   GT')?.linha, 'Angel GT')
})

test('nome sem linha conhecida não inventa palpite', () => {
  // Melhor não sugerir do que sugerir errado: o operador classifica na mão.
  assert.equal(sugerirClassificacao('PNEU GENÉRICO 120/70R17'), null)
  assert.equal(sugerirClassificacao('CANECA TÉRMICA 700ML'), null)
  assert.equal(sugerirClassificacao(''), null)
})

test('toda regra aponta para uma das categorias criadas na migration', () => {
  const migration = readFileSync(
    'prisma/migrations/20260922120000_pneu_segmentos/migration.sql',
    'utf8',
  )
  for (const regra of REGRAS_LINHA) {
    assert.ok(
      migration.includes(`'${regra.segmento}'`),
      `a regra "${regra.termo}" aponta para o segmento "${regra.segmento}", que não existe`,
    )
    assert.equal(regra.termo, regra.termo.toLowerCase(), `o termo "${regra.termo}" precisa ser minúsculo`)
  }
})

test('a sugestão nunca é gravada sozinha', () => {
  // Classificar é decisão comercial. A tela preenche o campo; quem escreve no
  // banco é o botão de salvar.
  const rota = readFileSync('app/api/admin/pneus-classificacao/route.ts', 'utf8')
  const put = rota.slice(rota.indexOf('export async function PUT'))
  assert.doesNotMatch(put, /sugerirClassificacao/, 'o PUT não pode aplicar sugestão por conta própria')

  const tela = readFileSync('components/admin/ClassificarPneus.tsx', 'utf8')
  const aplicar = tela.slice(tela.indexOf('function aplicarSugestoes'), tela.indexOf('function desfazer'))
  assert.doesNotMatch(aplicar, /fetch\(/, 'aplicar sugestões só preenche a tela, não salva')
})

test('o lote grava tudo ou nada', () => {
  // Meia classificação salva deixaria a vitrine incoerente sem ninguém saber
  // onde parou.
  const rota = readFileSync('app/api/admin/pneus-classificacao/route.ts', 'utf8')
  assert.match(rota, /prisma\.\$transaction\(/)
  const validacao = rota.indexOf('Categoria de pneu inexistente')
  const gravacao = rota.indexOf('prisma.$transaction(')
  assert.ok(validacao > 0 && validacao < gravacao, 'valida a categoria antes de gravar')
})
