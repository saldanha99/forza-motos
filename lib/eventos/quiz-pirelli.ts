import { randomInt } from 'node:crypto'

export type OrdemOpcoesQuiz = Record<string, string[]>

type PerguntaOrdenavelQuiz = {
  id: string
  respostaCorretaTexto?: string | null
}

function normalizarRespostaFinal(valor: string | null | undefined) {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('pt-BR')
    .replace(/[^A-Z0-9]/g, '')
}

function ehPerguntaFinalForza(pergunta: PerguntaOrdenavelQuiz) {
  return normalizarRespostaFinal(pergunta.respostaCorretaTexto) === 'FORZAMOTOS'
}

/** Fisher-Yates com aleatoriedade criptográfica no servidor. */
export function embaralharQuiz<T>(itens: readonly T[], sortear = (maximo: number) => randomInt(maximo)) {
  const resultado = [...itens]
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const sorteado = sortear(indice + 1)
    ;[resultado[indice], resultado[sorteado]] = [resultado[sorteado], resultado[indice]]
  }
  return resultado
}

/** Mantém a pergunta cuja resposta é FORZA MOTOS sempre no fim do quiz. */
export function fixarPerguntaFinalNoFim<T extends PerguntaOrdenavelQuiz>(perguntas: readonly T[]) {
  return [
    ...perguntas.filter((pergunta) => !ehPerguntaFinalForza(pergunta)),
    ...perguntas.filter(ehPerguntaFinalForza),
  ]
}

export function criarOrdemQuiz(
  perguntas: Array<PerguntaOrdenavelQuiz & { opcoes: Array<{ id: string }> }>,
  sortear = (maximo: number) => randomInt(maximo),
) {
  const ordemPerguntas = fixarPerguntaFinalNoFim(embaralharQuiz(perguntas, sortear))
    .map((pergunta) => pergunta.id)
  const ordemOpcoes = Object.fromEntries(
    perguntas.map((pergunta) => [pergunta.id, embaralharQuiz(pergunta.opcoes.map((opcao) => opcao.id), sortear)]),
  ) satisfies OrdemOpcoesQuiz
  return { ordemPerguntas, ordemOpcoes }
}

export function lerOrdemPerguntas(valor: unknown): string[] {
  if (!Array.isArray(valor) || valor.some((item) => typeof item !== 'string')) return []
  return valor
}

export function lerOrdemOpcoes(valor: unknown): OrdemOpcoesQuiz {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return {}
  const entradas = Object.entries(valor)
  if (entradas.some(([, ids]) => !Array.isArray(ids) || ids.some((id) => typeof id !== 'string'))) return {}
  return Object.fromEntries(entradas) as OrdemOpcoesQuiz
}

export function calcularDuracaoQuiz(iniciadaEm: Date, concluidaEm: Date) {
  const duracao = concluidaEm.getTime() - iniciadaEm.getTime()
  if (!Number.isFinite(duracao) || duracao < 0) throw new Error('CRONOMETRO_INVALIDO')
  return Math.min(2_147_483_647, duracao)
}

type ResultadoOrdenavelQuiz = {
  id: string
  duracaoMs: number | null
  concluidaEm: Date | string | null
}

/** Desempate único usado pela API pública, ranking e apuração final. */
export function compararResultadosQuiz(a: ResultadoOrdenavelQuiz, b: ResultadoOrdenavelQuiz) {
  const porDuracao = (a.duracaoMs ?? Number.POSITIVE_INFINITY) - (b.duracaoMs ?? Number.POSITIVE_INFINITY)
  if (porDuracao) return porDuracao
  const porConclusao = (a.concluidaEm ? new Date(a.concluidaEm).getTime() : Number.POSITIVE_INFINITY)
    - (b.concluidaEm ? new Date(b.concluidaEm).getTime() : Number.POSITIVE_INFINITY)
  if (porConclusao) return porConclusao
  if (a.id === b.id) return 0
  return a.id < b.id ? -1 : 1
}

export function formatarDuracaoQuiz(duracaoMs: number | null | undefined) {
  if (duracaoMs == null) return '—'
  const minutos = Math.floor(duracaoMs / 60_000)
  const segundos = Math.floor((duracaoMs % 60_000) / 1_000)
  const centesimos = Math.floor((duracaoMs % 1_000) / 10)
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`
}
