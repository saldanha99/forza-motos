'use client'

/* eslint-disable @next/next/no-img-element --
 * Os três <img> deste arquivo não podem virar next/image:
 *  - logoForzaUrl e logoPirelliUrl vêm de URL configurável no banco, de origem
 *    arbitrária, que não está liberada em next.config.mjs;
 *  - o QR do visitante é um data URI gerado em runtime.
 * Em ambos os casos o next/image quebraria a imagem em vez de otimizá-la.
 */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { CheckCircle2, Gift, Trophy, Wrench, Camera, AlertCircle } from 'lucide-react'

const STORAGE = 'forza-evento-pirelli-cadastro-v1'
const KEY_STORAGE = 'forza-evento-pirelli-submissao-v1'
const codigoStorage = 'forza-evento-pirelli-qr-v1'

type Evento = { titulo: string; descricao: string | null; local: string | null; dataInicio: string | null; logoForzaUrl: string | null; logoPirelliUrl: string | null; logoCampneusUrl: string | null; limiteNomeGravacao: number; ativo: boolean; publicado: boolean }

/**
 * Token opaco por dispositivo, usado só para idempotência do cadastro.
 * `crypto.randomUUID` não existe em contexto inseguro nem em Safari antigo — no
 * estande isso significaria alguém não conseguir se cadastrar, então há dois
 * fallbacks, ambos dentro do formato que a API aceita.
 */
function novaChave() {
  const c = typeof crypto !== 'undefined' ? crypto : undefined
  if (c?.randomUUID) return c.randomUUID()
  if (c?.getRandomValues) {
    return Array.from(c.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function EventoPirelliLanding({ evento, acao }: { evento: Evento; acao?: string }) {
  const [form, setForm] = useState({ nomeCompleto: '', nomeGravacao: '', whatsapp: '', email: '', instagram: '', confirmouNome: false, consentimentoMarketing: false })
  const [codigo, setCodigo] = useState('')
  const [qr, setQr] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [quiz, setQuiz] = useState<any>(null)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<any>(null)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE)
    const salvoCodigo = localStorage.getItem(codigoStorage)
    if (salvo) try { setForm((atual) => ({ ...atual, ...JSON.parse(salvo) })) } catch {}
    if (salvoCodigo) setCodigo(salvoCodigo)
  }, [])
  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(form)) }, [form])
  useEffect(() => { if (codigo) { localStorage.setItem(codigoStorage, codigo); QRCode.toDataURL(`${window.location.origin}/admin/evento-pirelli/atendimento?codigo=${encodeURIComponent(codigo)}`, { width: 260, margin: 1 }).then(setQr) } }, [codigo])
  // O carregamento ocorre quando o cadastro recuperado/hidratado disponibiliza o código.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (acao === 'quiz' && codigo) carregarQuiz() }, [acao, codigo])

  const nome = form.nomeGravacao.trim().replace(/\s+/g, ' ')
  const caracteresInvalidos = nome && !/^[a-zA-ZÀ-ÿ0-9 .,'-]+$/.test(nome)
  const cabe = nome.length <= evento.limiteNomeGravacao && !caracteresInvalidos
  const escala = useMemo(() => Math.max(0.68, Math.min(1.18, 22 / Math.max(nome.length || 1, 8))), [nome])

  async function cadastrar(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true)
    const chaveSubmissao = localStorage.getItem(KEY_STORAGE) ?? novaChave()
    localStorage.setItem(KEY_STORAGE, chaveSubmissao)
    try {
      const resposta = await fetch('/api/evento-pirelli/registro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, chaveSubmissao }) })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.error)
      setCodigo(dados.visitante.codigoQr)
      localStorage.removeItem(KEY_STORAGE)
      setErro('')
      if (acao === 'quiz') await carregarQuiz(dados.visitante.codigoQr)
    } catch (error: any) { setErro(error.message || 'A conexão falhou. Seus dados ficaram salvos neste aparelho; tente de novo.') }
    finally { setEnviando(false) }
  }
  async function carregarQuiz(codigoInformado = codigo) {
    const resposta = await fetch(`/api/evento-pirelli/quiz?codigo=${encodeURIComponent(codigoInformado)}`)
    const dados = await resposta.json(); if (resposta.ok) setQuiz(dados); else setErro(dados.error)
  }
  async function enviarQuiz() {
    const resposta = await fetch('/api/evento-pirelli/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo, respostas }) })
    const dados = await resposta.json(); if (resposta.ok) setResultado(dados); else setErro(dados.error)
  }
  async function participar(tipo: 'foto' | 'balanceamento') {
    const instagram = window.prompt('Seu @ do Instagram (sem @):', form.instagram)
    if (tipo === 'foto' && !instagram) return
    const resposta = await fetch('/api/evento-pirelli/participacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tipo === 'foto' ? { codigo, tipo, instagram, declarouMarcacoes: window.confirm('Você postou e marcou @forzamotos, Pirelli e Campneus?') } : { codigo, tipo, horario: window.prompt('Qual horário você prefere? (opcional)') }) })
    const dados = await resposta.json(); setErro(resposta.ok ? 'Participação registrada.' : dados.error)
  }

  if (!evento.ativo || !evento.publicado) return <main className="min-h-[60vh] grid place-items-center bg-[#101010] text-white p-6"><p>Este evento está temporariamente indisponível.</p></main>

  return <main className="min-h-screen bg-[#f7f7f5] text-[#141414] pb-12">
    <section className="bg-[#111] text-white px-5 py-7 border-b-4 border-[#f2c300]">
      <div className="max-w-xl mx-auto">
        <div className="flex gap-3 items-center mb-6">{evento.logoForzaUrl ? <img src={evento.logoForzaUrl} alt="Forza Motos" className="h-10 w-auto object-contain" /> : <strong className="font-barlow text-2xl tracking-wide">FORZA MOTOS</strong>}<span className="text-[#f2c300]">×</span>{evento.logoPirelliUrl ? <img src={evento.logoPirelliUrl} alt="Pirelli" className="h-10 w-auto object-contain" /> : <strong className="italic text-xl text-[#f2c300]">PIRELLI</strong>}</div>
        <p className="text-xs font-bold tracking-[.18em] text-[#f2c300] uppercase">Experiência no stand</p>
        <h1 className="font-barlow font-black text-4xl leading-none mt-2">{evento.titulo}</h1>
        <p className="text-white/75 mt-3">{evento.descricao || 'Cadastre-se uma vez, participe das atrações e acompanhe seus brindes.'}</p>
        {(evento.local || evento.dataInicio) && <p className="mt-3 text-sm text-white/65">{evento.local}{evento.local && evento.dataInicio ? ' · ' : ''}{evento.dataInicio && new Date(evento.dataInicio).toLocaleDateString('pt-BR')}</p>}
      </div>
    </section>
    <div className="max-w-xl mx-auto px-4 -mt-1">
      {!codigo ? <form onSubmit={cadastrar} className="bg-white shadow-lg rounded-2xl p-5 mt-5 space-y-4 border border-black/5">
        <div><h2 className="font-barlow font-black text-2xl">Seu cadastro</h2><p className="text-sm text-[#666]">Leva menos de um minuto. O nome abaixo será usado na gravação.</p></div>
        <label className="block text-sm font-bold">Nome completo<input required value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} className="mt-1 w-full rounded-lg border border-[#ccc] p-3 text-base" autoComplete="name" /></label>
        <label className="block text-sm font-bold">WhatsApp<input required inputMode="tel" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="mt-1 w-full rounded-lg border border-[#ccc] p-3 text-base" placeholder="(19) 99999-9999" autoComplete="tel" /></label>
        <label className="block text-sm font-bold">Nome para gravar na caneca <span className="text-[#d42b2b]">*</span><input required maxLength={evento.limiteNomeGravacao} value={form.nomeGravacao} onChange={(e) => setForm({ ...form, nomeGravacao: e.target.value })} className={`mt-1 w-full rounded-lg border p-3 text-base ${cabe ? 'border-[#ccc]' : 'border-red-500 bg-red-50'}`} placeholder="Ex.: Maria Fernanda" /></label>
        <div className="rounded-xl bg-[#171717] px-4 py-5 text-center text-white overflow-hidden"><p className="text-[10px] uppercase tracking-[.2em] text-[#f2c300]">Prévia de gravação — uma linha</p><p className="font-barlow font-black mt-2 whitespace-nowrap" style={{ fontSize: `${Math.round(26 * escala)}px` }}>{nome || 'SEU NOME'}</p><p className="text-xs text-white/55 mt-2">{nome.length}/{evento.limiteNomeGravacao} caracteres · {cabe ? 'cabe na área de gravação' : caracteresInvalidos ? 'remova emoji ou símbolo não gravável' : 'nome longo demais para uma linha'}</p></div>
        <label className="flex gap-3 text-sm items-start"><input required type="checkbox" checked={form.confirmouNome} onChange={(e) => setForm({ ...form, confirmouNome: e.target.checked })} className="mt-1 h-5 w-5" /><span>Confirmo que o nome acima está correto. A caneca será gravada exatamente assim.</span></label>
        <label className="flex gap-3 text-xs text-[#666] items-start"><input type="checkbox" checked={form.consentimentoMarketing} onChange={(e) => setForm({ ...form, consentimentoMarketing: e.target.checked })} className="mt-0.5 h-4 w-4" /><span>Quero receber novidades e ofertas da Forza Motos.</span></label>
        {erro && <p className="rounded-lg bg-red-50 text-red-700 p-3 text-sm flex gap-2"><AlertCircle size={18} />{erro}</p>}
        <button disabled={enviando || !cabe} className="w-full rounded-xl bg-[#d42b2b] py-4 font-bold text-white text-base disabled:opacity-50">{enviando ? 'Salvando com segurança…' : 'Confirmar cadastro'}</button>
      </form> : <section className="space-y-4 mt-5">
        <div className="bg-white rounded-2xl p-5 shadow-lg text-center"><CheckCircle2 className="text-emerald-600 mx-auto mb-2" size={34}/><h2 className="font-barlow font-black text-3xl">Cadastro confirmado</h2><p className="text-[#555]">Nome da caneca: <strong>{nome || form.nomeGravacao}</strong></p>{qr && <><img src={qr} alt="QR de atendimento" className="mx-auto w-52 h-52 mt-4"/><p className="text-xs text-[#666]">Apresente este QR à equipe para validar ou retirar sua caneca.</p></>}</div>
        {acao === 'quiz' && <Quiz quiz={quiz} respostas={respostas} setRespostas={setRespostas} resultado={resultado} onEnviar={enviarQuiz} />}
        <div className="grid grid-cols-1 gap-3"><button onClick={() => carregarQuiz()} className="flex gap-3 items-center text-left rounded-xl bg-[#111] text-white p-4"><Trophy className="text-[#f2c300]"/><span><b>Quiz de pneus</b><br/><small>Acertou tudo? Você entra na fila da caneca.</small></span></button><button onClick={() => participar('foto')} className="flex gap-3 items-center text-left rounded-xl bg-white p-4 shadow-sm"><Camera className="text-[#d42b2b]"/><span><b>Concurso de foto</b><br/><small>Registre seu @ e a equipe apura no Instagram.</small></span></button><button onClick={() => participar('balanceamento')} className="flex gap-3 items-center text-left rounded-xl bg-white p-4 shadow-sm"><Wrench className="text-[#d42b2b]"/><span><b>Aprenda balanceamento</b><br/><small>Informe interesse e horário preferido.</small></span></button></div>
        {erro && <p className="rounded-lg bg-[#fff4cc] p-3 text-sm">{erro}</p>}
      </section>}
    </div>
  </main>
}

function Quiz({ quiz, respostas, setRespostas, resultado, onEnviar }: any) {
  if (resultado) return <div className="bg-white rounded-2xl p-5 text-center shadow-sm"><Gift className="mx-auto text-[#d42b2b]"/><h2 className="font-barlow font-black text-2xl mt-2">{resultado.elegivelCaneca ? 'Você acertou tudo!' : 'Quiz concluído!'}</h2><p>{resultado.elegivelCaneca ? 'Sua caneca exclusiva entrou na fila de gravação.' : `Você fez ${resultado.tentativa.pontuacao} de ${resultado.tentativa.pontuacaoMaxima} pontos. Obrigado por participar!`}</p></div>
  if (!quiz) return <div className="bg-white rounded-2xl p-5 text-center">Carregando quiz…</div>
  if (quiz.tentativa) return <div className="bg-white rounded-2xl p-5 text-center">Sua tentativa oficial já foi registrada.</div>
  if (!quiz.perguntas?.length) return <div className="bg-white rounded-2xl p-5 text-center">O quiz está sendo preparado pela equipe.</div>
  return <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5"><h2 className="font-barlow font-black text-2xl">Quiz de pneus</h2>{quiz.perguntas.map((pergunta: any, indice: number) => <fieldset key={pergunta.id}><legend className="font-bold">{indice + 1}. {pergunta.enunciado}</legend><div className="mt-2 space-y-2">{pergunta.opcoes.map((opcao: any) => <label key={opcao.id} className="flex gap-2 rounded-lg border p-3 text-sm"><input type="radio" name={pergunta.id} checked={respostas[pergunta.id] === opcao.id} onChange={() => setRespostas({ ...respostas, [pergunta.id]: opcao.id })}/>{opcao.texto}</label>)}</div></fieldset>)}<button onClick={onEnviar} disabled={Object.keys(respostas).length !== quiz.perguntas.length} className="w-full rounded-xl bg-[#d42b2b] py-4 font-bold text-white disabled:opacity-50">Enviar tentativa oficial</button></div>
}
