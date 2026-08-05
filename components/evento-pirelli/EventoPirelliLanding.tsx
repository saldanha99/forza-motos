'use client'

/* eslint-disable @next/next/no-img-element --
 * Os <img> deste arquivo não podem virar next/image:
 *  - as logos aceitam URL configurável no banco, de origem arbitrária, que não
 *    está liberada em next.config.mjs (o fallback é asset local do repositório);
 *  - o QR do visitante é um data URI gerado em runtime.
 * Em ambos os casos o next/image quebraria a imagem em vez de otimizá-la.
 */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  AlertCircle, ArrowRight, AtSign, Camera, CheckCircle2, Gift,
  QrCode, Sparkles, Trophy, Wrench,
} from 'lucide-react'

const STORAGE = 'forza-evento-pirelli-cadastro-v1'
const KEY_STORAGE = 'forza-evento-pirelli-submissao-v1'
const codigoStorage = 'forza-evento-pirelli-qr-v1'

/** Assets do próprio repositório — usados quando o admin não configurou URL. */
const LOGO_FORZA_PADRAO = '/images/logo-forza.png'
const LOGO_PIRELLI_PADRAO = '/images/brands/pirelli.svg'

const AMARELO = '#f2c300'
const VERMELHO = '#d42b2b'

type Evento = {
  titulo: string
  descricao: string | null
  local: string | null
  dataInicio: string | null
  logoForzaUrl: string | null
  logoPirelliUrl: string | null
  logoCampneusUrl: string | null
  limiteNomeGravacao: number
  valorMinimoPneus: number
  ativo: boolean
  publicado: boolean
}

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
    return Array.from(c.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('')
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export function EventoPirelliLanding({ evento, acao }: { evento: Evento; acao?: string }) {
  const [form, setForm] = useState({
    nomeCompleto: '', nomeGravacao: '', whatsapp: '', email: '', instagram: '',
    confirmouNome: false, consentimentoMarketing: false,
  })
  const [codigo, setCodigo] = useState('')
  const [qr, setQr] = useState('')
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [quiz, setQuiz] = useState<any>(null)
  const [respostas, setRespostas] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<any>(null)
  const [painel, setPainel] = useState<'quiz' | 'foto' | 'balanceamento' | null>(null)

  useEffect(() => {
    const salvo = localStorage.getItem(STORAGE)
    const salvoCodigo = localStorage.getItem(codigoStorage)
    if (salvo) try { setForm((atual) => ({ ...atual, ...JSON.parse(salvo) })) } catch {}
    if (salvoCodigo) setCodigo(salvoCodigo)
  }, [])

  useEffect(() => { localStorage.setItem(STORAGE, JSON.stringify(form)) }, [form])

  useEffect(() => {
    if (!codigo) return
    localStorage.setItem(codigoStorage, codigo)
    QRCode.toDataURL(
      `${window.location.origin}/admin/evento-pirelli/atendimento?codigo=${encodeURIComponent(codigo)}`,
      { width: 320, margin: 1 },
    ).then(setQr)
  }, [codigo])

  // O carregamento ocorre quando o cadastro recuperado/hidratado disponibiliza o código.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (acao === 'quiz' && codigo) { setPainel('quiz'); carregarQuiz() } }, [acao, codigo])

  const nome = form.nomeGravacao.trim().replace(/\s+/g, ' ')
  const caracteresInvalidos = !!nome && !/^[a-zA-ZÀ-ÿ0-9 .,'-]+$/.test(nome)
  const cabe = nome.length <= evento.limiteNomeGravacao && !caracteresInvalidos
  const escala = useMemo(
    () => Math.max(0.68, Math.min(1.18, 22 / Math.max(nome.length || 1, 8))),
    [nome],
  )

  async function cadastrar(e: FormEvent) {
    e.preventDefault(); setErro(''); setEnviando(true)
    const chaveSubmissao = localStorage.getItem(KEY_STORAGE) ?? novaChave()
    localStorage.setItem(KEY_STORAGE, chaveSubmissao)
    try {
      const resposta = await fetch('/api/evento-pirelli/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, chaveSubmissao }),
      })
      const dados = await resposta.json()
      if (!resposta.ok) throw new Error(dados.error)
      setCodigo(dados.visitante.codigoQr)
      localStorage.removeItem(KEY_STORAGE)
      setErro('')
      if (acao === 'quiz') { setPainel('quiz'); await carregarQuiz(dados.visitante.codigoQr) }
    } catch (error: any) {
      setErro(error.message || 'A conexão falhou. Seus dados ficaram salvos neste aparelho; tente de novo.')
    } finally { setEnviando(false) }
  }

  async function carregarQuiz(codigoInformado = codigo) {
    const resposta = await fetch(`/api/evento-pirelli/quiz?codigo=${encodeURIComponent(codigoInformado)}`)
    const dados = await resposta.json()
    if (resposta.ok) setQuiz(dados); else setErro(dados.error)
  }

  async function enviarQuiz() {
    const resposta = await fetch('/api/evento-pirelli/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, respostas }),
    })
    const dados = await resposta.json()
    if (resposta.ok) setResultado(dados); else setErro(dados.error)
  }

  /** Payload idêntico ao da API — só a coleta deixou de ser window.prompt. */
  async function participar(
    tipo: 'foto' | 'balanceamento',
    extra: { instagram?: string; declarouMarcacoes?: boolean; horario?: string },
  ) {
    setErro(''); setAviso('')
    const corpo = tipo === 'foto'
      ? { codigo, tipo, instagram: extra.instagram, declarouMarcacoes: !!extra.declarouMarcacoes }
      : { codigo, tipo, horario: extra.horario ?? null }
    const resposta = await fetch('/api/evento-pirelli/participacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    const dados = await resposta.json()
    if (resposta.ok) { setAviso('Participação registrada. A equipe já consegue ver no estande.'); setPainel(null) }
    else setErro(dados.error)
  }

  if (!evento.ativo || !evento.publicado) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[#0e0e0e] p-6 text-white">
        <p className="text-white/70">Este evento está temporariamente indisponível.</p>
      </main>
    )
  }

  const logoForza = evento.logoForzaUrl || LOGO_FORZA_PADRAO
  const logoPirelli = evento.logoPirelliUrl || LOGO_PIRELLI_PADRAO
  const data = evento.dataInicio ? new Date(evento.dataInicio) : null

  return (
    <main className="min-h-screen bg-[#f6f6f4] text-[#141414]">

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0e0e0e] text-white">
        {/* Faixas diagonais discretas: dá profundidade sem competir com o conteúdo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ background: `repeating-linear-gradient(115deg, ${AMARELO} 0 2px, transparent 2px 22px)` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-[90px]"
          style={{ background: `${VERMELHO}55` }}
        />

        <div className="relative mx-auto max-w-2xl px-5 pb-12 pt-8">
          <Marcas forza={logoForza} pirelli={logoPirelli} campneus={evento.logoCampneusUrl} />

          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: AMARELO }}>
            Experiência no stand
          </p>
          <h1 className="mt-2 font-barlow text-[2.6rem] font-black leading-[0.95] sm:text-6xl">
            {evento.titulo}
          </h1>
          <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">
            {evento.descricao ||
              'Um cadastro só libera todas as atrações do dia — e a caneca com o seu nome gravado na hora.'}
          </p>

          {(evento.local || data) && (
            <p className="mt-5 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">
              {data && <span className="font-semibold text-white">{data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}</span>}
              {data && evento.local && <span className="text-white/30">·</span>}
              {evento.local && <span>{evento.local}</span>}
            </p>
          )}

          <a
            href="#cadastro"
            className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-bold text-white shadow-lg transition hover:brightness-110"
            style={{ background: VERMELHO, boxShadow: `0 12px 30px ${VERMELHO}55` }}
          >
            {codigo ? 'Ver meu QR e atrações' : 'Fazer meu cadastro'}
            <ArrowRight size={17} />
          </a>
          <p className="mt-2.5 text-xs text-white/45">Leva menos de um minuto. É de graça.</p>
        </div>
      </section>

      {/* ── A caneca: o gancho ──────────────────────────────────── */}
      <section className="mx-auto -mt-6 max-w-2xl px-4">
        <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-[0_20px_50px_-24px_rgba(0,0,0,0.35)]">
          <div className="flex items-center gap-2 px-6 pt-6">
            <Sparkles size={16} style={{ color: VERMELHO }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#777]">
              O brinde do dia
            </span>
          </div>
          <div className="px-6 pb-6 pt-3">
            <h2 className="font-barlow text-3xl font-black leading-tight">
              Caneca exclusiva, gravada com o seu nome
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[#555]">
              A gravação é feita na hora, no estande. Você escolhe o nome no cadastro e
              confere a prévia antes de confirmar.
            </p>
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <ComoGanhar titulo="Acerte o quiz inteiro" detalhe="Todas as perguntas certas" />
              <ComoGanhar titulo="Foto mais curtida" detalhe="Poste marcando as três marcas" />
              <ComoGanhar titulo={`Compre pneu a partir de ${brl(evento.valorMinimoPneus)}`} detalhe="A caneca vai junto" />
              <ComoGanhar titulo="Ou leve a sua" detalhe="Caneca personalizada avulsa" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Atrações ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-2xl px-4 pt-10">
        <h2 className="font-barlow text-2xl font-black">O que tem no estande</h2>
        <p className="mt-1 text-sm text-[#666]">Tudo liberado com o mesmo cadastro.</p>

        <div className="mt-5 space-y-3">
          <Atracao
            icone={<Trophy size={20} />}
            cor={AMARELO}
            titulo="Quiz de pneus"
            texto="Responda e ganhe brinde. Quem acerta todas as perguntas entra na fila da caneca gravada."
          />
          <Atracao
            icone={<Camera size={20} />}
            cor={VERMELHO}
            titulo="Foto com mais curtidas"
            texto="Tire a foto no estande e poste marcando @forzamotos, Pirelli e Campneus. A mais curtida leva caneca."
          />
          <Atracao
            icone={<Wrench size={20} />}
            cor="#2f7d4f"
            titulo="Aprenda a balancear"
            texto="Ferramental no estande e a equipe te ensinando a fazer o balanceamento na prática."
          />
          <Atracao
            icone={<Gift size={20} />}
            cor="#1f6feb"
            titulo="Pneu com brinde"
            texto={`Levou pneu a partir de ${brl(evento.valorMinimoPneus)}, a caneca personalizada vai junto. Também dá para comprar só a caneca.`}
          />
        </div>
      </section>

      {/* ── Cadastro / painel do visitante ──────────────────────── */}
      <div id="cadastro" className="mx-auto max-w-2xl px-4 py-10">
        {!codigo ? (
          <FormularioCadastro
            form={form} setForm={setForm} nome={nome} cabe={cabe}
            caracteresInvalidos={caracteresInvalidos} escala={escala}
            limite={evento.limiteNomeGravacao} enviando={enviando} erro={erro}
            onSubmit={cadastrar}
          />
        ) : (
          <PainelVisitante
            nome={nome || form.nomeGravacao} qr={qr} erro={erro} aviso={aviso}
            painel={painel} setPainel={setPainel}
            quiz={quiz} respostas={respostas} setRespostas={setRespostas}
            resultado={resultado} onEnviarQuiz={enviarQuiz} onCarregarQuiz={carregarQuiz}
            onParticipar={participar} instagramSalvo={form.instagram}
          />
        )}
      </div>
    </main>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Cabeçalho de marcas
   ═══════════════════════════════════════════════════════════════════ */

function Marcas({ forza, pirelli, campneus }: { forza: string; pirelli: string; campneus: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="rounded-lg bg-white px-3 py-2">
        <img src={forza} alt="Forza Motos" className="h-8 w-auto object-contain sm:h-9" />
      </span>
      <span aria-hidden style={{ color: AMARELO }} className="text-lg font-light">×</span>
      <img src={pirelli} alt="Pirelli" className="h-7 w-auto object-contain brightness-0 invert sm:h-8" />
      <span aria-hidden style={{ color: AMARELO }} className="text-lg font-light">×</span>
      {campneus ? (
        <img src={campneus} alt="Campneus" className="h-7 w-auto object-contain sm:h-8" />
      ) : (
        // Não há asset da Campneus no repositório — lockup tipográfico até subirem um.
        <strong className="font-barlow text-xl tracking-wide text-white/90">CAMPNEUS</strong>
      )}
    </div>
  )
}

function ComoGanhar({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="rounded-xl bg-[#f6f6f4] px-3.5 py-3">
      <p className="text-[13px] font-bold leading-snug">{titulo}</p>
      <p className="mt-0.5 text-xs text-[#777]">{detalhe}</p>
    </div>
  )
}

function Atracao({ icone, cor, titulo, texto }: { icone: React.ReactNode; cor: string; titulo: string; texto: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${cor}1a`, color: cor }}
      >
        {icone}
      </span>
      <div className="min-w-0">
        <h3 className="font-barlow text-lg font-bold leading-tight">{titulo}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#5a5a5a]">{texto}</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Cadastro
   ═══════════════════════════════════════════════════════════════════ */

function FormularioCadastro({
  form, setForm, nome, cabe, caracteresInvalidos, escala, limite, enviando, erro, onSubmit,
}: any) {
  const campo =
    'mt-1.5 w-full rounded-xl border border-[#d9d9d9] bg-white p-3.5 text-base outline-none transition focus:border-[#d42b2b] focus:ring-4 focus:ring-[#d42b2b]/12'

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-3xl border border-black/5 bg-white p-6 shadow-[0_20px_50px_-30px_rgba(0,0,0,0.4)]">
      <div>
        <h2 className="font-barlow text-3xl font-black">Seu cadastro</h2>
        <p className="mt-1 text-sm text-[#666]">
          Um só cadastro libera o quiz, o concurso de foto e o brinde. O nome abaixo é o que
          vai gravado na caneca.
        </p>
      </div>

      <label className="block text-sm font-bold">
        Nome completo
        <input
          required value={form.nomeCompleto}
          onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })}
          className={campo} autoComplete="name"
        />
      </label>

      <label className="block text-sm font-bold">
        WhatsApp
        <input
          required inputMode="tel" value={form.whatsapp}
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          className={campo} placeholder="(19) 99999-9999" autoComplete="tel"
        />
      </label>

      <label className="block text-sm font-bold">
        Nome para gravar na caneca <span style={{ color: VERMELHO }}>*</span>
        <input
          required maxLength={limite} value={form.nomeGravacao}
          onChange={(e) => setForm({ ...form, nomeGravacao: e.target.value })}
          className={`${campo} ${cabe ? '' : 'border-red-500 bg-red-50'}`}
          placeholder="Ex.: Maria Fernanda"
        />
      </label>

      {/* Prévia da gravação — o que evita caneca errada */}
      <div className="overflow-hidden rounded-2xl bg-[#141414] px-4 py-6 text-center text-white">
        <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: AMARELO }}>
          Prévia da gravação — uma linha
        </p>
        <p
          className="mt-3 whitespace-nowrap font-barlow font-black"
          style={{ fontSize: `${Math.round(30 * escala)}px` }}
        >
          {nome || 'SEU NOME'}
        </p>
        <p className="mt-3 text-xs text-white/55">
          {nome.length}/{limite} caracteres ·{' '}
          {cabe
            ? 'cabe na área de gravação'
            : caracteresInvalidos
              ? 'remova emoji ou símbolo não gravável'
              : 'nome longo demais para uma linha'}
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          required type="checkbox" checked={form.confirmouNome}
          onChange={(e) => setForm({ ...form, confirmouNome: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#d42b2b]"
        />
        <span>Confirmo que o nome está correto. A caneca será gravada exatamente assim.</span>
      </label>

      <label className="flex items-start gap-3 text-xs text-[#666]">
        <input
          type="checkbox" checked={form.consentimentoMarketing}
          onChange={(e) => setForm({ ...form, consentimentoMarketing: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#d42b2b]"
        />
        <span>Quero receber novidades e ofertas da Forza Motos.</span>
      </label>

      {erro && (
        <p className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="shrink-0" />
          {erro}
        </p>
      )}

      <button
        disabled={enviando || !cabe}
        className="w-full rounded-2xl py-4 text-base font-bold text-white transition disabled:opacity-50"
        style={{ background: VERMELHO, boxShadow: `0 12px 30px ${VERMELHO}44` }}
      >
        {enviando ? 'Salvando com segurança…' : 'Confirmar cadastro'}
      </button>
    </form>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Painel pós-cadastro
   ═══════════════════════════════════════════════════════════════════ */

function PainelVisitante({
  nome, qr, erro, aviso, painel, setPainel, quiz, respostas, setRespostas,
  resultado, onEnviarQuiz, onCarregarQuiz, onParticipar, instagramSalvo,
}: any) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-black/5 bg-white p-6 text-center shadow-[0_20px_50px_-30px_rgba(0,0,0,0.4)]">
        <CheckCircle2 className="mx-auto mb-2 text-emerald-600" size={34} />
        <h2 className="font-barlow text-3xl font-black">Cadastro confirmado</h2>
        <p className="mt-1 text-[#555]">
          Nome da caneca: <strong>{nome}</strong>
        </p>
        {qr && (
          <>
            <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-3 ring-1 ring-black/10">
              <img src={qr} alt="QR de atendimento" className="h-52 w-52" />
            </div>
            <p className="mx-auto mt-3 flex max-w-xs items-center justify-center gap-1.5 text-xs text-[#666]">
              <QrCode size={13} className="shrink-0" />
              Apresente este QR à equipe para validar o quiz ou retirar sua caneca.
            </p>
          </>
        )}
      </div>

      {aviso && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
      {erro && <p className="rounded-xl bg-[#fff4cc] p-3 text-sm text-[#7a5c00]">{erro}</p>}

      {painel === 'quiz' && (
        <Quiz quiz={quiz} respostas={respostas} setRespostas={setRespostas} resultado={resultado} onEnviar={onEnviarQuiz} />
      )}
      {painel === 'foto' && <FormFoto instagramSalvo={instagramSalvo} onEnviar={onParticipar} onCancelar={() => setPainel(null)} />}
      {painel === 'balanceamento' && <FormBalanceamento onEnviar={onParticipar} onCancelar={() => setPainel(null)} />}

      {!painel && (
        <div className="space-y-3">
          <BotaoAtracao
            destaque cor={AMARELO} icone={<Trophy size={20} />}
            titulo="Fazer o quiz de pneus" texto="Acertou tudo? Sua caneca entra na fila."
            onClick={() => { setPainel('quiz'); onCarregarQuiz() }}
          />
          <BotaoAtracao
            cor={VERMELHO} icone={<Camera size={20} />}
            titulo="Concurso de foto" texto="Registre seu @ e a equipe apura as curtidas."
            onClick={() => setPainel('foto')}
          />
          <BotaoAtracao
            cor="#2f7d4f" icone={<Wrench size={20} />}
            titulo="Aprender balanceamento" texto="Escolha o melhor horário para você."
            onClick={() => setPainel('balanceamento')}
          />
        </div>
      )}
    </div>
  )
}

function BotaoAtracao({ icone, cor, titulo, texto, onClick, destaque }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left transition hover:brightness-105 ${
        destaque ? 'bg-[#141414] text-white' : 'border border-black/5 bg-white shadow-sm'
      }`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: `${cor}1f`, color: cor }}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-barlow text-lg font-bold leading-tight">{titulo}</span>
        <span className={`mt-0.5 block text-sm ${destaque ? 'text-white/65' : 'text-[#666]'}`}>{texto}</span>
      </span>
      <ArrowRight size={18} className={destaque ? 'text-white/50' : 'text-[#bbb]'} />
    </button>
  )
}

/* ── Foto: substitui window.prompt + window.confirm ──────────────── */

function FormFoto({ instagramSalvo, onEnviar, onCancelar }: any) {
  const [instagram, setInstagram] = useState(instagramSalvo ?? '')
  const [marcou, setMarcou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const handle = instagram.trim().replace(/^@/, '')

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="font-barlow text-2xl font-black">Concurso de foto</h2>
      <p className="mt-1 text-sm text-[#666]">
        Poste a foto tirada no estande marcando <b>@forzamotos</b>, <b>Pirelli</b> e{' '}
        <b>Campneus</b>. A equipe apura as curtidas.
      </p>

      <label className="mt-4 block text-sm font-bold">
        Seu @ do Instagram
        <span className="mt-1.5 flex items-center rounded-xl border border-[#d9d9d9] bg-white focus-within:border-[#d42b2b] focus-within:ring-4 focus-within:ring-[#d42b2b]/12">
          <AtSign size={16} className="ml-3 shrink-0 text-[#999]" />
          <input
            value={instagram} onChange={(e) => setInstagram(e.target.value)}
            className="w-full bg-transparent p-3.5 pl-2 text-base outline-none"
            placeholder="seuperfil" autoCapitalize="none" autoCorrect="off"
          />
        </span>
      </label>

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          type="checkbox" checked={marcou} onChange={(e) => setMarcou(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#d42b2b]"
        />
        <span>Já postei e marquei as três marcas.</span>
      </label>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button onClick={onCancelar} className="rounded-xl border border-[#d9d9d9] py-3.5 font-bold text-[#555]">
          Voltar
        </button>
        <button
          disabled={!handle || enviando}
          onClick={async () => { setEnviando(true); await onEnviar('foto', { instagram: handle, declarouMarcacoes: marcou }); setEnviando(false) }}
          className="rounded-xl py-3.5 font-bold text-white disabled:opacity-50"
          style={{ background: VERMELHO }}
        >
          {enviando ? 'Enviando…' : 'Participar'}
        </button>
      </div>
    </div>
  )
}

/* ── Balanceamento: substitui window.prompt ──────────────────────── */

function FormBalanceamento({ onEnviar, onCancelar }: any) {
  const [horario, setHorario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const opcoes = ['Manhã', 'Início da tarde', 'Fim da tarde', 'Tanto faz']

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
      <h2 className="font-barlow text-2xl font-black">Aprenda a balancear</h2>
      <p className="mt-1 text-sm text-[#666]">
        A equipe leva o ferramental e te ensina na prática. Escolha o horário que fica melhor.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {opcoes.map((o) => (
          <button
            key={o} onClick={() => setHorario(o)}
            className={`rounded-xl border py-3 text-sm font-semibold transition ${
              horario === o ? 'border-transparent text-white' : 'border-[#d9d9d9] text-[#444]'
            }`}
            style={horario === o ? { background: '#2f7d4f' } : undefined}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <button onClick={onCancelar} className="rounded-xl border border-[#d9d9d9] py-3.5 font-bold text-[#555]">
          Voltar
        </button>
        <button
          disabled={enviando}
          onClick={async () => { setEnviando(true); await onEnviar('balanceamento', { horario: horario || undefined }); setEnviando(false) }}
          className="rounded-xl py-3.5 font-bold text-white disabled:opacity-50"
          style={{ background: '#2f7d4f' }}
        >
          {enviando ? 'Enviando…' : 'Quero participar'}
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Quiz
   ═══════════════════════════════════════════════════════════════════ */

function Quiz({ quiz, respostas, setRespostas, resultado, onEnviar }: any) {
  const [enviando, setEnviando] = useState(false)

  if (resultado) {
    const ganhou = resultado.elegivelCaneca
    return (
      <div className="rounded-3xl border border-black/5 bg-white p-7 text-center shadow-sm">
        <span
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: ganhou ? `${AMARELO}22` : '#f2f2f0', color: ganhou ? '#b58900' : '#888' }}
        >
          {ganhou ? <Trophy size={26} /> : <Gift size={26} />}
        </span>
        <h2 className="mt-3 font-barlow text-2xl font-black">
          {ganhou ? 'Você acertou tudo!' : 'Quiz concluído!'}
        </h2>
        <p className="mt-1 text-[#555]">
          {ganhou
            ? 'Sua caneca exclusiva entrou na fila de gravação. Mostre seu QR no estande.'
            : `Você fez ${resultado.tentativa.pontuacao} de ${resultado.tentativa.pontuacaoMaxima} pontos. Obrigado por participar!`}
        </p>
      </div>
    )
  }

  if (!quiz) return <Cartao>Carregando quiz…</Cartao>
  if (quiz.tentativa) return <Cartao>Sua tentativa oficial já foi registrada.</Cartao>
  if (!quiz.perguntas?.length) return <Cartao>O quiz está sendo preparado pela equipe.</Cartao>

  const respondidas = Object.keys(respostas).length
  const total = quiz.perguntas.length

  return (
    <div className="space-y-5 rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
      <div>
        <h2 className="font-barlow text-2xl font-black">Quiz de pneus</h2>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eee]">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${(respondidas / total) * 100}%`, background: VERMELHO }}
            />
          </div>
          <span className="text-xs font-semibold tabular-nums text-[#777]">
            {respondidas}/{total}
          </span>
        </div>
      </div>

      {quiz.perguntas.map((pergunta: any, indice: number) => (
        <fieldset key={pergunta.id}>
          <legend className="font-bold leading-snug">
            {indice + 1}. {pergunta.enunciado}
          </legend>
          <div className="mt-2.5 space-y-2">
            {pergunta.opcoes.map((opcao: any) => {
              const marcada = respostas[pergunta.id] === opcao.id
              return (
                <label
                  key={opcao.id}
                  className={`flex cursor-pointer gap-2.5 rounded-xl border p-3.5 text-sm transition ${
                    marcada ? 'border-[#d42b2b] bg-[#d42b2b]/[0.06]' : 'border-[#e2e2e2]'
                  }`}
                >
                  <input
                    type="radio" name={pergunta.id} checked={marcada}
                    onChange={() => setRespostas({ ...respostas, [pergunta.id]: opcao.id })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#d42b2b]"
                  />
                  {opcao.texto}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}

      <button
        onClick={async () => { setEnviando(true); await onEnviar(); setEnviando(false) }}
        disabled={respondidas !== total || enviando}
        className="w-full rounded-2xl py-4 font-bold text-white transition disabled:opacity-50"
        style={{ background: VERMELHO, boxShadow: `0 12px 30px ${VERMELHO}44` }}
      >
        {enviando ? 'Enviando…' : 'Enviar tentativa oficial'}
      </button>
      <p className="-mt-2 text-center text-xs text-[#888]">
        Você tem uma tentativa oficial. Confira antes de enviar.
      </p>
    </div>
  )
}

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-6 text-center text-[#555] shadow-sm">
      {children}
    </div>
  )
}
