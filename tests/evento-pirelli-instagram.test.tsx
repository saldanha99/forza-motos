import assert from 'node:assert/strict'
import test from 'node:test'
import type { Dispatch, SetStateAction } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QuizPublicoEventoPirelli } from '@/components/evento-pirelli/QuizPublicoEventoPirelli'

const setRespostas = (() => undefined) as Dispatch<SetStateAction<Record<string, string>>>
const onEnviar = async () => undefined
const onAtualizarResultado = async () => undefined

function renderizarResultado(classificadoQuiz: boolean) {
  return renderToStaticMarkup(
    <QuizPublicoEventoPirelli
      quiz={{ perguntas: [] }}
      respostas={{}}
      setRespostas={setRespostas}
      resultado={{
        classificadoQuiz,
        posicaoAtual: classificadoQuiz ? 2 : null,
        quizEncerrado: false,
        vencedorQuiz: false,
        tentativa: {
          pontuacao: classificadoQuiz ? 8 : 7,
          pontuacaoMaxima: 8,
          acertouTodas: classificadoQuiz,
          duracaoMs: 65_430,
        },
      }}
      onEnviar={onEnviar}
      linkConfirmacaoCaneca="/evento-pirelli/caneca/confirmar?token=teste"
      onAtualizarResultado={onAtualizarResultado}
    />,
  )
}

test('quiz perfeito entra no ranking e informa o desempate por tempo', () => {
  const html = renderizarResultado(true)
  assert.match(html, /Você entrou no ranking/)
  assert.match(html, /01:05\.43/)
  assert.match(html, /Posição provisória: 2º/)
  assert.match(html, /menor tempo oficial/)
})

test('quiz incompleto não promete caneca', () => {
  const html = renderizarResultado(false)
  assert.match(html, /7 de 8 pontos/)
  assert.match(html, /necessário acertar todas/)
  assert.doesNotMatch(html, /Brinde liberado/)
})

test('tentativa concluída não é reaberta', () => {
  const html = renderToStaticMarkup(
    <QuizPublicoEventoPirelli
      quiz={{ tentativa: { concluidaEm: new Date().toISOString(), acertouTodas: true }, perguntas: [] }}
      respostas={{}}
      setRespostas={setRespostas}
      resultado={null}
      onEnviar={onEnviar}
      linkConfirmacaoCaneca="/evento-pirelli/caneca/confirmar?token=teste"
      onAtualizarResultado={onAtualizarResultado}
    />,
  )
  assert.match(html, /tentativa oficial já foi concluída/)
  assert.match(html, /única vez/)
})

test('vencedor recebe link seguro para confirmar a caneca sem QR operacional', () => {
  const html = renderToStaticMarkup(
    <QuizPublicoEventoPirelli
      quiz={{ perguntas: [] }}
      respostas={{}}
      setRespostas={setRespostas}
      resultado={{
        classificadoQuiz: true,
        posicaoAtual: 1,
        quizEncerrado: true,
        vencedorQuiz: true,
        tentativa: { pontuacao: 8, pontuacaoMaxima: 8, acertouTodas: true, duracaoMs: 8_900 },
      }}
      onEnviar={onEnviar}
      linkConfirmacaoCaneca="/evento-pirelli/caneca/confirmar?token=teste"
      onAtualizarResultado={onAtualizarResultado}
    />,
  )
  assert.match(html, /Você ganhou a caneca/)
  assert.match(html, /Confirmar nome da caneca/)
  assert.match(html, /Prêmio liberado no sistema/)
  assert.doesNotMatch(html, /QR individual/)
})
