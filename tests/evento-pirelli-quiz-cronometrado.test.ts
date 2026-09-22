import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  calcularDuracaoQuiz,
  compararResultadosQuiz,
  criarOrdemQuiz,
  embaralharQuiz,
  fixarPerguntaFinalNoFim,
  formatarDuracaoQuiz,
} from '@/lib/eventos/quiz-pirelli'

test('embaralhamento preserva itens e não altera o conjunto original', () => {
  const original = ['p1', 'p2', 'p3', 'p4'] as const
  const sorteios = [0, 1, 0]
  const embaralhado = embaralharQuiz(original, () => sorteios.shift() ?? 0)
  assert.deepEqual(original, ['p1', 'p2', 'p3', 'p4'])
  assert.deepEqual([...embaralhado].sort(), [...original].sort())
  assert.notDeepEqual(embaralhado, original)
})

test('a pergunta FORZA MOTOS fica fixa no final e as demais continuam sorteadas', () => {
  const perguntas = [
    { id: 'p1', respostaCorretaTexto: null, opcoes: [{ id: 'p1-a' }, { id: 'p1-b' }] },
    { id: 'final', respostaCorretaTexto: ' Forza-Motos! ', opcoes: [] },
    { id: 'p2', respostaCorretaTexto: null, opcoes: [{ id: 'p2-a' }, { id: 'p2-b' }] },
    { id: 'p3', respostaCorretaTexto: null, opcoes: [{ id: 'p3-a' }, { id: 'p3-b' }] },
  ]
  const sorteios = [0, 1, 0, 0, 0, 0]
  const ordem = criarOrdemQuiz(perguntas, () => sorteios.shift() ?? 0)

  assert.equal(ordem.ordemPerguntas.at(-1), 'final')
  assert.deepEqual([...ordem.ordemPerguntas.slice(0, -1)].sort(), ['p1', 'p2', 'p3'])
  assert.notDeepEqual(ordem.ordemPerguntas.slice(0, -1), ['p1', 'p2', 'p3'])
})

test('tentativas já iniciadas também recebem a pergunta FORZA MOTOS no final', () => {
  const ordemAntiga = [
    { id: 'p2', respostaCorretaTexto: null },
    { id: 'final', respostaCorretaTexto: 'FORZA MOTOS' },
    { id: 'p1', respostaCorretaTexto: null },
  ]

  assert.deepEqual(fixarPerguntaFinalNoFim(ordemAntiga).map((pergunta) => pergunta.id), ['p2', 'p1', 'final'])
})

test('duração usa timestamps oficiais e rejeita relógio incoerente', () => {
  assert.equal(calcularDuracaoQuiz(new Date('2026-08-12T10:00:00.000Z'), new Date('2026-08-12T10:01:05.430Z')), 65_430)
  assert.throws(
    () => calcularDuracaoQuiz(new Date('2026-08-12T10:00:01.000Z'), new Date('2026-08-12T10:00:00.000Z')),
    /CRONOMETRO_INVALIDO/,
  )
  assert.equal(formatarDuracaoQuiz(65_430), '01:05.43')
})

test('ranking desempata por duração, conclusão e id de forma determinística', () => {
  const resultados = [
    { id: 'tentativa-c', duracaoMs: 10_000, concluidaEm: '2026-08-12T10:00:20.000Z' },
    { id: 'tentativa-b', duracaoMs: 9_000, concluidaEm: '2026-08-12T10:00:30.000Z' },
    { id: 'tentativa-a', duracaoMs: 10_000, concluidaEm: '2026-08-12T10:00:20.000Z' },
  ].sort(compararResultadosQuiz)
  assert.deepEqual(resultados.map((item) => item.id), ['tentativa-b', 'tentativa-a', 'tentativa-c'])
})

test('participantes não entram em fila entre si e o servidor fixa início e recebimento', () => {
  const rota = readFileSync('app/api/evento-pirelli/quiz/route.ts', 'utf8')
  const biblioteca = readFileSync('lib/evento-pirelli.ts', 'utf8')

  assert.match(biblioteca, /pg_advisory_xact_lock_shared/)
  assert.match(rota, /bloquearQuizEventoCompartilhado\(tx, visitante\.eventoId\)/)
  assert.match(rota, /iniciadaEm: relogio\.agora/)

  const recebimento = rota.indexOf('const concluidaEmRecebida = relogioRecebimento.agora')
  const buscaVisitante = rota.indexOf('const visitante = await prisma.eventoPirelliVisitante.findUnique', rota.indexOf('export async function POST'))
  assert.ok(recebimento >= 0 && recebimento < buscaVisitante, 'o instante final deve ser capturado assim que a submissão válida chega ao servidor')
  assert.match(rota, /const concluidaEm = concluidaEmRecebida/)
})

test('apuração bloqueia direitos legados divergentes e nunca os revoga automaticamente', () => {
  const biblioteca = readFileSync('lib/evento-pirelli.ts', 'utf8')
  const inicio = biblioteca.indexOf('export async function encerrarQuizEConfirmarVencedor')
  const fim = biblioteca.indexOf('/**\n * Corrigir um vencedor de foto', inicio)
  const apuracao = biblioteca.slice(inicio, fim)

  assert.match(apuracao, /tentativasLegadasSemTempo/)
  assert.match(apuracao, /status: \{ in: \['EM_GRAVACAO', 'PRONTA', 'ENTREGUE'\] \}/)
  assert.match(apuracao, /Apuração bloqueada:[\s\S]*Nada foi alterado/)
  assert.match(apuracao, /vencedor && !vencedorJaTinhaDireito/)
  assert.doesNotMatch(apuracao, /eventoPirelliElegibilidadeCaneca\.update/)
  assert.doesNotMatch(apuracao, /status: 'CANCELADA'/)
})

test('resultado concluído continua consultável e o CSV usa o mesmo desempate oficial', () => {
  const rotaPublica = readFileSync('app/api/evento-pirelli/quiz/route.ts', 'utf8')
  const landing = readFileSync('components/evento-pirelli/EventoPirelliLanding.tsx', 'utf8')
  const exportacao = readFileSync('app/api/admin/evento-pirelli/export/route.ts', 'utf8')

  const tentativaConcluida = rotaPublica.indexOf('if (tentativa?.concluidaEm)')
  const disponibilidade = rotaPublica.indexOf('if (!eventoDisponivel(visitante.evento))')
  assert.ok(tentativaConcluida >= 0 && tentativaConcluida < disponibilidade)
  assert.match(landing, /Consultar meu resultado/)
  assert.match(exportacao, /\.sort\(compararResultadosQuiz\)/)
})
