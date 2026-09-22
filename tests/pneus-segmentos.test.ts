import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { slugLinha, filtroProdutosDoSegmento } from '../lib/pneus/segmentos'

test('slug da linha aguenta acento, caixa e pontuação', () => {
  assert.equal(slugLinha('Angel GT'), 'angel-gt')
  assert.equal(slugLinha('  Diablo Rosso IV  '), 'diablo-rosso-iv')
  assert.equal(slugLinha('Sportmax Q5'), 'sportmax-q5')
  assert.equal(slugLinha('Pneu Esportivo/Street'), 'pneu-esportivo-street')
  assert.equal(slugLinha('Ação 2.0'), 'acao-2-0')
  // Nome só com símbolo não vira URL — a API recusa antes de gravar.
  assert.equal(slugLinha('!!!'), '')
})

test('o sync do Olist não encosta na classificação de pneu', () => {
  // A categoria do ERP é "Pneu >> <marca>": não diz uso da moto. Se o sync
  // escrevesse nestes campos, ele apagaria a classificação feita pela loja a
  // cada rodada do worker.
  const arquivos = [
    'lib/olist/sync-products.ts',
    'worker/worker.js',
    'app/api/admin/produtos/[id]/sync/route.ts',
  ]
  for (const caminho of arquivos) {
    const fonte = readFileSync(caminho, 'utf8')
    assert.doesNotMatch(fonte, /pneuSegmentoId/, `${caminho} não pode escrever pneuSegmentoId`)
    assert.doesNotMatch(fonte, /pneuLinha/, `${caminho} não pode escrever pneuLinha`)
  }
})

test('formulário do produto manda null, e não string vazia, na categoria de pneu', () => {
  // A coluna é FK: gravar '' estoura com violação de chave estrangeira.
  const form = readFileSync('components/admin/ProdutoForm.tsx', 'utf8')
  assert.match(form, /pneuSegmentoId: form\.pneuSegmentoId \|\| null/)
  assert.match(form, /pneuLinha: String\(form\.pneuLinha\)\.trim\(\) \|\| null/)
})

test('apagar categoria com produto dentro é recusado', () => {
  // A FK é SetNull: apagar desclassificaria os produtos em silêncio.
  const rota = readFileSync('app/api/admin/pneus-segmentos/[id]/route.ts', 'utf8')
  const guarda = rota.indexOf('_count.produtos > 0')
  const apaga = rota.indexOf('pneuSegmento.delete')
  assert.ok(guarda > 0, 'a rota precisa conferir quantos produtos a categoria tem')
  assert.ok(guarda < apaga, 'a checagem tem que vir antes do delete')
  assert.match(rota, /status: 409/)
})

test('a vitrine de pneus só conta produto publicado', () => {
  // Contagem no card não pode incluir oculto, sem foto ou produto de evento —
  // senão o cliente clica numa categoria que parece cheia e chega no vazio.
  const lib = readFileSync('lib/pneus/segmentos.ts', 'utf8')
  const filtro = lib.slice(lib.indexOf('const PRODUTO_PUBLICADO'), lib.indexOf('export async function listarSegmentos'))
  for (const campo of ['ativo: true', 'temImagem: true', 'ocultoManual: false', 'eventoPirelliId: null']) {
    assert.ok(filtro.includes(campo), `filtro de vitrine precisa de ${campo}`)
  }
})

test('grafias diferentes da mesma linha viram um card só', () => {
  // O campo é digitado a mão em cada produto. Sem juntar por slug, "Angel GT" e
  // "angel gt" viravam dois cards apontando para o mesmo link — e um deles
  // nunca abriria.
  const lib = readFileSync('lib/pneus/segmentos.ts', 'utf8')
  const corpo = lib.slice(lib.indexOf('export async function listarLinhas'))
  assert.match(corpo, /porSlug/, 'listarLinhas precisa agrupar pelo slug')
  assert.doesNotMatch(
    corpo.slice(0, corpo.indexOf('export function filtroProdutosDoSegmento')),
    /slug: slugLinha\(g\.pneuLinha\)/,
    'não pode voltar a montar uma linha por registro do groupBy',
  )
  assert.equal(slugLinha('Angel GT'), slugLinha('angel  gt'))
})

test('a página da linha filtra por todas as grafias, não por uma', () => {
  const filtro = filtroProdutosDoSegmento('seg1', ['Angel GT', 'angel gt'])
  assert.deepEqual((filtro as { pneuLinha?: unknown }).pneuLinha, { in: ['Angel GT', 'angel gt'] })

  // Sem linha, o filtro não pode restringir por pneuLinha — senão a página do
  // segmento mostraria só produto classificado.
  assert.equal('pneuLinha' in filtroProdutosDoSegmento('seg1'), false)
  assert.equal('pneuLinha' in filtroProdutosDoSegmento('seg1', []), false)
})
