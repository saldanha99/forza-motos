'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, PackageCheck, Trophy } from 'lucide-react'

export type PerguntaQuizPublico = {
  id: string
  enunciado: string
  tipo: 'MULTIPLA_ESCOLHA' | 'TEXTO'
  pontos: number
  opcoes: Array<{ id: string; texto: string }>
}

export type QuizPublico = {
  tentativa?: {
    id?: string
    iniciadaEm?: string
    concluidaEm?: string | null
    pontuacao?: number
    pontuacaoMaxima?: number
    acertouTodas?: boolean
    duracaoMs?: number | null
  } | null
  perguntas: PerguntaQuizPublico[]
}

export type ResultadoQuizPublico = {
  classificadoQuiz: boolean
  posicaoAtual: number | null
  quizEncerrado: boolean
  vencedorQuiz: boolean
  tentativa: {
    pontuacao: number
    pontuacaoMaxima: number
    acertouTodas: boolean
    duracaoMs: number | null
  }
}

type Props = {
  quiz: QuizPublico | null
  respostas: Record<string, string>
  setRespostas: React.Dispatch<React.SetStateAction<Record<string, string>>>
  resultado: ResultadoQuizPublico | null
  onEnviar: () => Promise<void>
  linkConfirmacaoCaneca: string
  onAtualizarResultado: () => Promise<void>
}

function formatarDuracao(duracaoMs: number | null | undefined) {
  if (duracaoMs == null) return '—'
  const minutos = Math.floor(duracaoMs / 60_000)
  const segundos = Math.floor((duracaoMs % 60_000) / 1_000)
  const centesimos = Math.floor((duracaoMs % 1_000) / 10)
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`
}

export function QuizPublicoEventoPirelli({ quiz, respostas, setRespostas, resultado, onEnviar, linkConfirmacaoCaneca, onAtualizarResultado }: Props) {
  const [indice, setIndice] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [atualizando, setAtualizando] = useState(false)

  const total = quiz?.perguntas.length ?? 0
  useEffect(() => {
    if (total > 0 && indice >= total) setIndice(total - 1)
  }, [indice, total])

  const pergunta = quiz?.perguntas[indice]
  const respostaAtual = pergunta ? respostas[pergunta.id] ?? '' : ''
  const preenchida = Boolean(respostaAtual.trim())
  const respondidas = useMemo(
    () => quiz?.perguntas.filter((item) => Boolean(respostas[item.id]?.trim())).length ?? 0,
    [quiz, respostas],
  )

  if (resultado) {
    const classificado = resultado.classificadoQuiz
    const vencedor = resultado.vencedorQuiz
    const aguardandoApuracao = classificado && !resultado.quizEncerrado
    return (
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111114] p-7 text-center text-white shadow-2xl sm:p-10">
        <span className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${vencedor || aguardandoApuracao ? 'bg-[#f5b82e] text-black' : 'bg-white/10 text-white/60'}`}>
          {vencedor || aguardandoApuracao ? <Trophy size={38} /> : <Check size={34} />}
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-[#f5b82e]">Tentativa registrada</p>
        <h2 className="mt-2 font-barlow text-4xl font-black uppercase leading-none sm:text-5xl">
          {vencedor ? 'Você ganhou a caneca!' : aguardandoApuracao ? 'Você entrou no ranking!' : resultado.quizEncerrado && classificado ? 'Apuração encerrada' : 'Quiz concluído'}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/65">
          {vencedor
            ? `Você acertou todas em ${formatarDuracao(resultado.tentativa.duracaoMs)} e terminou com o menor tempo oficial.`
            : aguardandoApuracao
              ? `Você acertou todas em ${formatarDuracao(resultado.tentativa.duracaoMs)}. A posição ainda é provisória até a equipe encerrar o quiz.`
              : classificado
                ? `Você acertou todas em ${formatarDuracao(resultado.tentativa.duracaoMs)}, mas outro participante concluiu em menos tempo.`
            : `Você fez ${resultado.tentativa.pontuacao} de ${resultado.tentativa.pontuacaoMaxima} pontos. Para concorrer à caneca é necessário acertar todas.`}
        </p>
        {aguardandoApuracao && resultado.posicaoAtual ? <p className="mt-4 text-sm font-bold text-[#f5b82e]">Posição provisória: {resultado.posicaoAtual}º</p> : null}
        {aguardandoApuracao ? (
          <button
            type="button"
            disabled={atualizando}
            onClick={async () => {
              setAtualizando(true)
              try { await onAtualizarResultado() } finally { setAtualizando(false) }
            }}
            className="mt-5 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/75 transition hover:border-white/30 hover:text-white disabled:opacity-45"
          >
            {atualizando ? 'Atualizando…' : 'Atualizar apuração'}
          </button>
        ) : null}
        {vencedor ? (
          <Link href={linkConfirmacaoCaneca} className="mx-auto mt-6 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[#f5b82e] px-6 font-barlow text-sm font-black uppercase tracking-wider text-black transition hover:bg-[#ffd369]">
            Confirmar nome da caneca
          </Link>
        ) : null}
        <div className="mx-auto mt-6 flex max-w-md items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
          <PackageCheck size={22} className="mt-0.5 shrink-0 text-[#f5b82e]" />
          <p className="text-sm leading-relaxed text-white/60">
            <strong className="block text-white">{vencedor ? 'Prêmio liberado no sistema' : 'Resultado após a apuração'}</strong>
            {vencedor
              ? 'Confirme o nome pelo link acima. A equipe verá automaticamente seu prêmio e acompanhará gravação e entrega pelo painel.'
              : 'O vencedor será quem acertar tudo no menor tempo oficial registrado pelo servidor.'}
          </p>
        </div>
      </section>
    )
  }

  if (!quiz) return <CartaoQuiz>Carregando o desafio…</CartaoQuiz>
  if (quiz.tentativa?.concluidaEm) {
    return <CartaoQuiz>Sua tentativa oficial já foi concluída. Cada participante pode responder uma única vez.</CartaoQuiz>
  }
  if (!pergunta) return <CartaoQuiz>O quiz está sendo configurado no sistema.</CartaoQuiz>

  const ultima = indice === total - 1

  async function avancar() {
    if (!preenchida) return
    if (!ultima) {
      setIndice((atual) => atual + 1)
      return
    }
    setEnviando(true)
    try { await onEnviar() } finally { setEnviando(false) }
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111114] text-white shadow-2xl">
      <header className="border-b border-white/10 px-6 py-5 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#f5b82e]">Quiz Pirelli × Forza</p>
            <p className="mt-1 text-sm text-white/55">Questão {indice + 1} de {total}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/65">{respondidas}/{total}</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-[#dc1f26] to-[#f5b82e] transition-[width] duration-500" style={{ width: `${((indice + 1) / total) * 100}%` }} />
        </div>
      </header>

      <div className="px-6 py-7 sm:px-8 sm:py-9">
        <p className="mb-5 flex items-center gap-2 text-xs font-semibold text-white/45"><Clock3 size={15} className="text-[#f5b82e]" /> O tempo oficial já está sendo contado pelo servidor.</p>
        <fieldset>
          <legend className="whitespace-pre-line font-barlow text-2xl font-black leading-tight text-white sm:text-3xl">{pergunta.enunciado}</legend>

          {pergunta.tipo === 'TEXTO' ? (
            <div className="mt-7">
              <label htmlFor={`resposta-${pergunta.id}`} className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-white/55">Sua resposta</label>
              <input id={`resposta-${pergunta.id}`} value={respostaAtual} onChange={(event) => setRespostas((atuais) => ({ ...atuais, [pergunta.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter' && preenchida) void avancar() }} maxLength={80} autoComplete="off" autoCapitalize="characters" placeholder="Digite aqui" className="w-full rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-4 text-lg font-bold uppercase text-white outline-none transition focus:border-[#f5b82e] focus:ring-4 focus:ring-[#f5b82e]/10" />
              <p className="mt-2 text-xs text-white/40">Não diferenciamos maiúsculas, acentos ou espaços.</p>
            </div>
          ) : (
            <div className="mt-7 grid gap-3">
              {pergunta.opcoes.map((opcao, posicao) => {
                const marcada = respostaAtual === opcao.id
                return (
                  <label key={opcao.id} className={`group flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition ${marcada ? 'border-[#f5b82e] bg-[#f5b82e]/10' : 'border-white/10 bg-white/[0.04] hover:border-white/25'}`}>
                    <input type="radio" name={pergunta.id} checked={marcada} onChange={() => setRespostas((atuais) => ({ ...atuais, [pergunta.id]: opcao.id }))} className="sr-only" />
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-black ${marcada ? 'border-[#f5b82e] bg-[#f5b82e] text-black' : 'border-white/20 text-white/45'}`}>{marcada ? <Check size={16} strokeWidth={3} /> : String.fromCharCode(65 + posicao)}</span>
                    <span className="text-sm font-semibold leading-snug text-white/85 sm:text-base">{opcao.texto}</span>
                  </label>
                )
              })}
            </div>
          )}
        </fieldset>

        <div className="mt-8 grid grid-cols-[auto_1fr] gap-3">
          <button type="button" onClick={() => setIndice((atual) => Math.max(0, atual - 1))} disabled={indice === 0 || enviando} aria-label="Voltar à pergunta anterior" className="grid h-14 w-14 place-items-center rounded-2xl border border-white/15 text-white transition hover:bg-white/5 disabled:opacity-30"><ArrowLeft size={20} /></button>
          <button type="button" onClick={() => void avancar()} disabled={!preenchida || enviando} className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#dc1f26] px-5 font-barlow text-sm font-black uppercase tracking-[0.1em] text-white shadow-[0_14px_35px_rgba(220,31,38,0.3)] transition hover:bg-[#ef2930] disabled:cursor-not-allowed disabled:opacity-40">
            {enviando ? 'Validando…' : ultima ? 'Enviar tentativa oficial' : 'Próxima pergunta'}
            {!enviando && <ArrowRight size={18} />}
          </button>
        </div>
        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/35">Perguntas e alternativas foram sorteadas para você. Uma tentativa por participante.</p>
      </div>
    </section>
  )
}

function CartaoQuiz({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[2rem] border border-white/10 bg-[#111114] p-8 text-center text-sm font-medium text-white/65 shadow-2xl">{children}</div>
}
