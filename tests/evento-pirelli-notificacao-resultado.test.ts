import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { normalizarDestinoWhatsApp } from '@/lib/evolution/client'
import {
  conteudoResultadoQuizPirelli,
  formatarDuracaoResultadoQuizPirelli,
} from '@/lib/eventos/notificacoes-resultado-quiz-pirelli'

test('preserva JID de grupo e continua normalizando telefone individual', () => {
  assert.equal(normalizarDestinoWhatsApp('120363427125752663@g.us'), '120363427125752663@g.us')
  assert.equal(normalizarDestinoWhatsApp('(19) 99277-4625'), '5519992774625')
})

test('monta o resultado oficial sem permitir quebra de linha no nome', () => {
  const conteudo = conteudoResultadoQuizPirelli({
    nome: 'Maria\nSilva',
    whatsapp: '(19) 99999-0000',
    pontuacao: 10,
    pontuacaoMaxima: 10,
    duracaoMs: 62_349,
  })

  assert.match(conteudo, /Vencedor: \*Maria Silva\*/)
  assert.match(conteudo, /WhatsApp: 5519999990000/)
  assert.match(conteudo, /Resultado: 10\/10/)
  assert.match(conteudo, /Tempo oficial: \*01:02\.34\*/)
  assert.equal(formatarDuracaoResultadoQuizPirelli(9_999), '00:09.99')
})

test('encerramento enfileira cliente, responsável e grupo com chaves idempotentes', () => {
  const rota = readFileSync('app/api/admin/evento-pirelli/quiz/route.ts', 'utf8')
  const notificacao = readFileSync('lib/eventos/notificacoes-resultado-quiz-pirelli.ts', 'utf8')

  assert.match(rota, /enfileirarConfirmacaoCanecaPirelli/)
  assert.match(rota, /enfileirarResultadoQuizPirelli/)
  assert.match(notificacao, /resultado:\$\{destino\.canal\}/)
  assert.match(notificacao, /EVENTO_PIRELLI_RESULTADO_WHATSAPP/)
  assert.match(notificacao, /EVENTO_PIRELLI_RESULTADO_GRUPO_JID/)
})
