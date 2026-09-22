'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, FileText, ListChecks, Plus, RefreshCw, Trophy, Users } from 'lucide-react'

type OpcaoForm = { texto: string; correta: boolean }
type FormQuiz = {
  enunciado: string
  explicacao: string
  pontos: number
  tipo: 'MULTIPLA_ESCOLHA' | 'TEXTO'
  respostaCorretaTexto: string
  opcoes: OpcaoForm[]
}

type PerguntaAdmin = {
  id: string
  enunciado: string
  explicacao: string | null
  pontos: number
  ordem: number
  ativa: boolean
  tipo: 'MULTIPLA_ESCOLHA' | 'TEXTO'
  respostaCorretaTexto: string | null
  opcoes: Array<{ id: string; texto: string; correta: boolean }>
}

type ItemRanking = {
  id: string
  posicao: number
  pontuacao: number
  pontuacaoMaxima: number
  duracaoMs: number | null
  concluidaEm: string | null
  vencedorConfirmado: boolean
  visitante: { id: string; nomeCompleto: string; whatsapp: string; nomeGravacao: string | null }
}

type ResumoQuiz = { total: number; concluidas: number; perfeitas: number; emAndamento: number }
type ApuracaoQuiz = {
  quizEncerradoEm: string | null
  quizEncerradoPor: string | null
  quizVencedorTentativaId: string | null
}

function formatarDuracao(duracaoMs: number) {
  const minutos = Math.floor(duracaoMs / 60_000)
  const segundos = Math.floor((duracaoMs % 60_000) / 1_000)
  const centesimos = Math.floor((duracaoMs % 1_000) / 10)
  return `${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}.${String(centesimos).padStart(2, '0')}`
}

function novoFormulario(): FormQuiz {
  return {
    enunciado: '',
    explicacao: '',
    pontos: 1,
    tipo: 'MULTIPLA_ESCOLHA',
    respostaCorretaTexto: '',
    opcoes: [
      { texto: '', correta: true },
      { texto: '', correta: false },
      { texto: '', correta: false },
      { texto: '', correta: false },
    ],
  }
}

const campo = 'w-full rounded-xl border border-brand-border bg-black/20 p-3 text-brand-text outline-none transition-colors focus:border-brand-accent'

export function QuizEventoPirelliAdmin() {
  const [perguntas, setPerguntas] = useState<PerguntaAdmin[]>([])
  const [form, setForm] = useState<FormQuiz>(novoFormulario)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [ranking, setRanking] = useState<ItemRanking[]>([])
  const [tentativas, setTentativas] = useState<ItemRanking[]>([])
  const [resumo, setResumo] = useState<ResumoQuiz>({ total: 0, concluidas: 0, perfeitas: 0, emAndamento: 0 })
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null)
  const [apuracao, setApuracao] = useState<ApuracaoQuiz>({ quizEncerradoEm: null, quizEncerradoPor: null, quizVencedorTentativaId: null })
  const [atualizando, setAtualizando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const carregar = useCallback(async () => {
    const resposta = await fetch('/api/admin/evento-pirelli/perguntas')
    const dados = await resposta.json()
    if (resposta.ok) {
      setPerguntas(dados)
      setErro('')
    } else setErro(dados.error)
  }, [])

  useEffect(() => { void carregar() }, [carregar])

  const carregarRanking = useCallback(async () => {
    setAtualizando(true)
    const resposta = await fetch('/api/admin/evento-pirelli/quiz')
    const dados = await resposta.json()
    setAtualizando(false)
    if (resposta.ok) {
      setRanking(dados.ranking)
      setTentativas(dados.tentativas)
      setResumo(dados.resumo)
      setApuracao(dados.apuracao)
      setAtualizadoEm(dados.atualizadoEm)
    }
    else setErro(dados.error)
  }, [])

  useEffect(() => {
    void carregarRanking()
    const intervalo = window.setInterval(() => void carregarRanking(), 10_000)
    return () => window.clearInterval(intervalo)
  }, [carregarRanking])

  async function confirmarVencedor() {
    const avisoEmAndamento = resumo.emAndamento
      ? ` Há ${resumo.emAndamento} tentativa(s) em andamento que não poderão mais ser enviada(s).`
      : ''
    if (!window.confirm(`Encerrar o quiz agora? Esta ação bloqueia novas respostas e congela definitivamente o vencedor.${avisoEmAndamento}`)) return
    setConfirmando(true)
    setErro('')
    setSucesso('')
    const resposta = await fetch('/api/admin/evento-pirelli/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'encerrar-e-apurar' }),
    })
    const dados = await resposta.json()
    setConfirmando(false)
    if (resposta.ok) {
      setRanking(dados.ranking)
      setTentativas(dados.tentativas)
      setResumo(dados.resumo)
      setApuracao(dados.apuracao)
      setAtualizadoEm(dados.atualizadoEm)
      setSucesso(dados.vencedor
        ? 'Quiz encerrado. O vencedor, o responsável e o grupo foram colocados na fila de avisos do WhatsApp.'
        : 'Quiz encerrado sem vencedor: ninguém acertou todas as respostas.')
    }
    else setErro(dados.error)
  }

  async function criar(event: FormEvent) {
    event.preventDefault()
    setSalvando(true)
    setErro('')
    const resposta = await fetch('/api/admin/evento-pirelli/perguntas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const dados = await resposta.json()
    setSalvando(false)
    if (resposta.ok) {
      setForm(novoFormulario())
      await carregar()
    } else setErro(dados.error)
  }

  async function alternar(pergunta: PerguntaAdmin) {
    const resposta = await fetch(`/api/admin/evento-pirelli/perguntas/${pergunta.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativa: !pergunta.ativa }),
    })
    if (resposta.ok) await carregar()
    else setErro((await resposta.json()).error)
  }

  function atualizarOpcao(indice: number, alteracao: Partial<OpcaoForm>) {
    setForm((atual) => ({
      ...atual,
      opcoes: atual.opcoes.map((opcao, posicao) => (
        posicao === indice ? { ...opcao, ...alteracao } : opcao
      )),
    }))
  }

  function marcarCorreta(indice: number) {
    setForm((atual) => ({
      ...atual,
      opcoes: atual.opcoes.map((opcao, posicao) => ({ ...opcao, correta: posicao === indice })),
    }))
  }

  return (
    <main className="mx-auto max-w-5xl pb-20">
      <Link href="/admin/evento-pirelli" className="text-sm text-brand-muted">← Evento Pirelli</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-barlow text-4xl font-black text-brand-text">Perguntas do quiz</h1>
          <p className="mt-1 max-w-2xl text-brand-muted">As tentativas guardam snapshots; alterações futuras não reescrevem o histórico do participante.</p>
        </div>
        <span className="rounded-full border border-brand-border bg-brand-surface px-4 py-2 text-sm text-brand-muted">
          {perguntas.filter((pergunta) => pergunta.ativa).length} ativas
        </span>
      </div>

      {erro && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{erro}</p>}
      {sucesso && <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{sucesso}</p>}

      <section className="mt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Começaram', resumo.total],
            ['Concluíram', resumo.concluidas],
            ['Gabaritaram', resumo.perfeitas],
            ['Em andamento', resumo.emAndamento],
          ].map(([rotulo, valor]) => <div key={rotulo} className="rounded-2xl border border-brand-border bg-brand-surface p-4"><p className="font-barlow text-3xl font-black text-brand-text">{valor}</p><p className="text-xs text-brand-muted">{rotulo}</p></div>)}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-brand-muted">
          <span>Atualização automática a cada 10 segundos{atualizadoEm ? ` · ${new Date(atualizadoEm).toLocaleTimeString('pt-BR')}` : ''}</span>
          <button type="button" onClick={() => void carregarRanking()} disabled={atualizando} className="inline-flex items-center gap-2 rounded-xl border border-brand-border px-3 py-2 font-bold text-brand-text disabled:opacity-50"><RefreshCw size={14} className={atualizando ? 'animate-spin' : ''} /> Atualizar agora</button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 font-bold text-brand-text"><Trophy size={19} className="text-amber-300" /> Ranking por menor tempo</p>
            <p className="mt-1 text-sm text-brand-muted">O servidor calcula o ranking automaticamente. Entram apenas participantes que acertaram todas; em empate exato, vence quem concluiu primeiro. O botão apenas encerra novas respostas e congela o resultado.</p>
            {apuracao.quizEncerradoEm ? (
              <p className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                Quiz encerrado em {new Date(apuracao.quizEncerradoEm).toLocaleString('pt-BR')} por {apuracao.quizEncerradoPor ?? 'Equipe'}.
                {apuracao.quizVencedorTentativaId ? ' O vencedor está congelado.' : ' Ninguém gabaritou; não houve vencedor.'}
              </p>
            ) : null}
          </div>
          <button type="button" disabled={confirmando || Boolean(apuracao.quizEncerradoEm)} onClick={() => void confirmarVencedor()} className="rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-white disabled:opacity-45">
            {confirmando ? 'Encerrando…' : apuracao.quizEncerradoEm ? 'Quiz encerrado' : 'Encerrar quiz e apurar'}
          </button>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-border text-left text-brand-muted"><tr><th className="p-3">Posição</th><th className="p-3">Participante</th><th className="p-3">Tempo</th><th className="p-3">Situação</th></tr></thead>
            <tbody>{ranking.map((item) => <tr key={item.id} className="border-b border-brand-border/50 text-brand-text">
              <td className="p-3 font-black">{item.posicao}º</td>
              <td className="p-3"><b>{item.visitante.nomeCompleto}</b><br/><span className="text-xs text-brand-muted">{item.visitante.whatsapp}</span></td>
              <td className="p-3"><span className="inline-flex items-center gap-2 font-mono font-bold"><Clock3 size={15} /> {formatarDuracao(item.duracaoMs!)}</span></td>
              <td className="p-3">{item.vencedorConfirmado ? <span className="font-bold text-emerald-300">Vencedor confirmado</span> : item.posicao === 1 && !apuracao.quizEncerradoEm ? <span className="text-amber-300">Líder provisório</span> : apuracao.quizEncerradoEm ? 'Apuração encerrada' : 'Classificado'}</td>
            </tr>)}</tbody>
          </table>
          {!ranking.length ? <p className="p-5 text-center text-sm text-brand-muted">Ainda não há tentativa perfeita cronometrada.</p> : null}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
        <p className="flex items-center gap-2 font-bold text-brand-text"><Users size={19} className="text-brand-accent" /> Pessoas que fizeram o quiz</p>
        <p className="mt-1 text-sm text-brand-muted">Últimas 100 tentativas, inclusive quem ainda está respondendo.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-border text-left text-brand-muted"><tr><th className="p-3">Participante</th><th className="p-3">Resultado</th><th className="p-3">Tempo</th><th className="p-3">Situação</th></tr></thead>
            <tbody>{tentativas.map((item) => <tr key={item.id} className="border-b border-brand-border/50 text-brand-text">
              <td className="p-3"><b>{item.visitante.nomeCompleto}</b><br/><span className="text-xs text-brand-muted">{item.visitante.whatsapp}</span></td>
              <td className="p-3">{item.concluidaEm ? `${item.pontuacao}/${item.pontuacaoMaxima}` : 'Respondendo'}</td>
              <td className="p-3 font-mono">{item.duracaoMs !== null ? formatarDuracao(item.duracaoMs) : '—'}</td>
              <td className="p-3">{item.vencedorConfirmado ? <span className="font-bold text-emerald-300">Vencedor</span> : item.posicao ? <span className="text-amber-300">{item.posicao}º no ranking</span> : item.concluidaEm ? 'Concluído' : <span className="text-blue-300">Em andamento</span>}</td>
            </tr>)}</tbody>
          </table>
          {!tentativas.length && <p className="p-5 text-center text-sm text-brand-muted">Ainda ninguém iniciou o quiz.</p>}
        </div>
      </section>

      <form onSubmit={criar} className="mt-6 space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-accent/15 text-brand-accent"><Plus size={20} /></span>
          <div>
            <h2 className="font-bold text-brand-text">Nova pergunta</h2>
            <p className="text-xs text-brand-muted">{resumo.total > 0 ? 'Perguntas congeladas: a primeira tentativa já começou.' : 'Escolha entre alternativas ou resposta digitada.'}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <label className="text-sm font-medium text-brand-muted">
            Enunciado
            <textarea required value={form.enunciado} onChange={(event) => setForm({ ...form, enunciado: event.target.value })} className={`${campo} mt-1 min-h-28`} />
          </label>
          <label className="text-sm font-medium text-brand-muted">
            Formato
            <select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value as FormQuiz['tipo'] })} className={`${campo} mt-1`}>
              <option value="MULTIPLA_ESCOLHA">Alternativas</option>
              <option value="TEXTO">Resposta digitada</option>
            </select>
          </label>
        </div>

        <label className="block text-sm font-medium text-brand-muted">
          Explicação após a resposta <span className="font-normal">(opcional)</span>
          <input value={form.explicacao} onChange={(event) => setForm({ ...form, explicacao: event.target.value })} className={`${campo} mt-1`} />
        </label>

        {form.tipo === 'TEXTO' ? (
          <label className="block text-sm font-medium text-brand-muted">
            Resposta correta
            <input required value={form.respostaCorretaTexto} onChange={(event) => setForm({ ...form, respostaCorretaTexto: event.target.value })} placeholder="Ex.: FORZA MOTOS" className={`${campo} mt-1`} />
            <span className="mt-1 block text-xs text-brand-muted">Maiúsculas, acentos, espaços e pontuação não alteram a correção.</span>
          </label>
        ) : (
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-brand-muted">Alternativas — marque uma correta</legend>
            {form.opcoes.map((opcao, indice) => (
              <label key={indice} className="flex items-center gap-3 rounded-xl border border-brand-border bg-black/10 p-2">
                <input type="radio" name="correta" checked={opcao.correta} onChange={() => marcarCorreta(indice)} className="h-4 w-4 accent-brand-accent" />
                <input required={indice < 2} value={opcao.texto} onChange={(event) => atualizarOpcao(indice, { texto: event.target.value })} placeholder={`Opção ${indice + 1}`} className="min-w-0 flex-1 bg-transparent p-2 text-brand-text outline-none" />
              </label>
            ))}
          </fieldset>
        )}

        <button disabled={salvando || resumo.total > 0} className="inline-flex items-center gap-2 rounded-xl bg-brand-accent px-5 py-3 font-bold text-white disabled:opacity-50">
          <Plus size={17} /> {salvando ? 'Adicionando…' : resumo.total > 0 ? 'Quiz congelado' : 'Adicionar pergunta'}
        </button>
      </form>

      <div className="mt-6 grid gap-3">
        {perguntas.map((pergunta, indice) => (
          <article key={pergunta.id} className={`rounded-2xl border p-5 ${pergunta.ativa ? 'border-brand-border bg-brand-surface' : 'border-brand-border/60 bg-brand-surface/40 opacity-65'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-bg text-sm font-bold text-brand-muted">{indice + 1}</span>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-bg px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-brand-muted">
                      {pergunta.tipo === 'TEXTO' ? <FileText size={12} /> : <ListChecks size={12} />}
                      {pergunta.tipo === 'TEXTO' ? 'Digitada' : 'Alternativas'}
                    </span>
                    {!pergunta.ativa && <span className="text-xs font-semibold text-amber-300">Desativada</span>}
                  </div>
                  <p className="whitespace-pre-line font-bold text-brand-text">{pergunta.enunciado}</p>
                </div>
              </div>
              <button type="button" disabled={resumo.total > 0} onClick={() => alternar(pergunta)} className="shrink-0 text-sm font-semibold text-brand-accent disabled:cursor-not-allowed disabled:opacity-40">
                {pergunta.ativa ? 'Desativar' : 'Ativar'}
              </button>
            </div>

            <div className="ml-12 mt-3">
              {pergunta.tipo === 'TEXTO' ? (
                <p className="inline-flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-sm text-emerald-300">
                  <CheckCircle2 size={15} /> {pergunta.respostaCorretaTexto}
                </p>
              ) : (
                <ol className="grid gap-1.5 text-sm text-brand-muted sm:grid-cols-2">
                  {pergunta.opcoes.map((opcao) => (
                    <li key={opcao.id} className={opcao.correta ? 'font-semibold text-emerald-300' : ''}>
                      {opcao.correta ? '✓ ' : '• '}{opcao.texto}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  )
}
