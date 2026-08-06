'use client'

/* eslint-disable @next/next/no-img-element --
 * Os <img> deste arquivo não podem virar next/image:
 *  - as logos aceitam URL configurável no banco, de origem arbitrária;
 *  - o QR do visitante é um data URI gerado em runtime.
 */

import { FormEvent, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  AlertCircle, ArrowRight, AtSign, Camera, CheckCircle2, Gift,
  QrCode, Sparkles, Trophy, Wrench, ShieldCheck, Flame, Star
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
      <main className="grid min-h-[60vh] place-items-center bg-[#0e0e0e] p-6 text-white font-inter">
        <div className="text-center space-y-3">
          <p className="text-xl font-bold text-white/90">Evento Temporariamente Indisponível</p>
          <p className="text-sm text-white/60">Acompanhe as novidades da Forza Motos nas redes sociais.</p>
        </div>
      </main>
    )
  }

  const logoForza = evento.logoForzaUrl || LOGO_FORZA_PADRAO
  const logoPirelli = evento.logoPirelliUrl || LOGO_PIRELLI_PADRAO
  const data = evento.dataInicio ? new Date(evento.dataInicio) : null

  return (
    <main className="min-h-screen bg-[#f8f9fa] text-[#141414] font-inter antialiased">

      {/* ── HERO PREMIUM ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0a0a0f] text-white py-12 md:py-16">
        {/* Pattern de fundo discreto */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ background: `repeating-linear-gradient(135deg, ${AMARELO} 0 2px, transparent 2px 24px)` }}
        />
        {/* Glows de cor */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full blur-[120px] opacity-40"
          style={{ background: VERMELHO }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-20 -bottom-20 h-96 w-96 rounded-full blur-[140px] opacity-20"
          style={{ background: AMARELO }}
        />

        <div className="relative mx-auto max-w-3xl px-6 sm:px-8">
          {/* Header de Marcas */}
          <Marcas forza={logoForza} pirelli={logoPirelli} campneus={evento.logoCampneusUrl} />

          {/* Badge & Título */}
          <div className="mt-10">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-sm"
              style={{ background: `${AMARELO}20`, color: AMARELO, border: `1px solid ${AMARELO}40` }}
            >
              <Flame size={13} className="animate-pulse" /> Experiência Oficial no Stand
            </span>

            <h1 className="mt-4 font-barlow text-4xl sm:text-6xl font-black leading-[0.95] tracking-tight text-white">
              {evento.titulo}
            </h1>

            <p className="mt-5 text-base sm:text-lg leading-relaxed text-gray-300 font-normal max-w-2xl">
              {evento.descricao ||
                'Um único cadastro libera todas as atrações do estande — incluindo a sua caneca exclusiva gravada na hora! 🏍️🔥'}
            </p>
          </div>

          {/* Badge de Data / Local */}
          {(evento.local || data) && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 backdrop-blur-md px-4 py-2.5 text-sm text-white/90 shadow-sm">
                <Star size={15} style={{ color: AMARELO }} />
                {data && <span className="font-semibold text-white">{data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
                {data && evento.local && <span className="text-white/40">|</span>}
                {evento.local && <span className="text-gray-200">{evento.local}</span>}
              </div>
            </div>
          )}

          {/* Botão de Ação Hero */}
          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <a
              href="#cadastro"
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-base font-barlow font-bold uppercase tracking-wider text-white shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] w-full sm:w-auto text-center"
              style={{
                background: `linear-gradient(135deg, ${VERMELHO} 0%, #b81d1d 100%)`,
                boxShadow: `0 12px 35px ${VERMELHO}55`,
              }}
            >
              {codigo ? 'Ver meu QR Code & Atrações' : 'Garantir meu cadastro gratuito'}
              <ArrowRight size={18} />
            </a>
            <p className="text-xs text-white/50 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" /> Rápido e 100% Gratuito
            </p>
          </div>
        </div>
      </section>

      {/* ── A CANECA: O GANCHO PREMIUM ─────────────────────────── */}
      <section className="mx-auto -mt-8 max-w-3xl px-6 sm:px-8 relative z-20">
        <div className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.12)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-[#d42b2b]">
              <Sparkles size={16} />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#d42b2b]">
              Brinde Exclusivo do Dia
            </span>
          </div>

          <h2 className="font-barlow text-3xl sm:text-4xl font-black leading-tight text-gray-900 mt-1">
            Caneca Oficial, gravada com o seu nome na hora!
          </h2>
          <p className="mt-3 text-base text-gray-600 leading-relaxed">
            A gravação a laser é feita presencialmente no estande. Você cadastra seu nome, confere a prévia em tempo real e retira sua caneca personalizada.
          </p>

          {/* Grid Como Ganhar */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ComoGanhar titulo="🏆 Ganhar pelo Quiz" detalhe="Acerte as perguntas sobre pneus no stand" />
            <ComoGanhar titulo="📸 Concurso de Foto" detalhe="Poste a foto no stand marcando as marcas" />
            <ComoGanhar titulo={`🛒 Pneu a partir de ${brl(evento.valorMinimoPneus)}`} detalhe="Ganhe a caneca gravada na compra" />
            <ComoGanhar titulo="🎁 Personalizar Avulsa" detalhe="Ou leve a sua caneca exclusiva na hora" />
          </div>
        </div>
      </section>

      {/* ── ATRAÇÕES DO STAND ──────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-6 sm:px-8 py-12">
        <div className="text-center sm:text-left mb-6">
          <h2 className="font-barlow text-3xl font-black text-gray-900">Atrações Exclusivas no Stand</h2>
          <p className="mt-1 text-sm text-gray-500">Tudo liberado com o seu cadastro único abaixo.</p>
        </div>

        <div className="space-y-4">
          <Atracao
            icone={<Trophy size={22} />}
            cor={AMARELO}
            titulo="Quiz de Pneus Pirelli"
            texto="Responda o quiz rápido, teste seus conhecimentos e concorra à caneca personalizada."
          />
          <Atracao
            icone={<Camera size={22} />}
            cor={VERMELHO}
            titulo="Concurso de Foto no Stand"
            texto="Tire fotos incríveis no estande e poste no Instagram marcando @forzamotos, Pirelli e Campneus!"
          />
          <Atracao
            icone={<Wrench size={22} />}
            cor="#2f7d4f"
            titulo="Oficina Prática de Balanceamento"
            texto="Conheça o ferramental profissional e aprenda a realizar o balanceamento de pneus na prática com os nossos técnicos."
          />
          <Atracao
            icone={<Gift size={22} />}
            cor="#1f6feb"
            titulo="Pneu com Brinde Especial"
            texto={`Comprou pneus Pirelli a partir de ${brl(evento.valorMinimoPneus)}, a caneca com gravação a laser vai de presente.`}
          />
        </div>
      </section>

      {/* ── CADASTRO / PAINEL DO VISITANTE ────────────────────── */}
      <div id="cadastro" className="mx-auto max-w-3xl px-6 sm:px-8 pb-16">
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
   Cabeçalho de Marcas
   ═══════════════════════════════════════════════════════════════════ */

function Marcas({ forza, pirelli, campneus }: { forza: string; pirelli: string; campneus: string | null }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-4 sm:gap-6 rounded-2xl bg-white/10 backdrop-blur-md p-3.5 px-5 border border-white/15 shadow-xl">
      <span className="rounded-xl bg-white p-2 flex items-center justify-center shadow-sm">
        <img src={forza} alt="Forza Motos" className="h-7 sm:h-9 w-auto object-contain" />
      </span>
      <span aria-hidden style={{ color: AMARELO }} className="text-xl font-light opacity-80">×</span>
      <img src={pirelli} alt="Pirelli" className="h-7 sm:h-8 w-auto object-contain brightness-0 invert" />
      <span aria-hidden style={{ color: AMARELO }} className="text-xl font-light opacity-80">×</span>
      {campneus ? (
        <img src={campneus} alt="Campneus" className="h-7 sm:h-8 w-auto object-contain" />
      ) : (
        <strong className="font-barlow text-lg tracking-wider text-white font-bold">CAMPNEUS</strong>
      )}
    </div>
  )
}

function ComoGanhar({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="rounded-2xl bg-[#f8f9fa] border border-gray-100 p-4 transition-all hover:bg-white hover:shadow-sm">
      <p className="text-sm font-bold text-gray-900 leading-snug">{titulo}</p>
      <p className="mt-1 text-xs text-gray-500 leading-relaxed">{detalhe}</p>
    </div>
  )
}

function Atracao({ icone, cor, titulo, texto }: { icone: React.ReactNode; cor: string; titulo: string; texto: string }) {
  return (
    <div className="flex gap-4 sm:gap-5 rounded-2xl border border-gray-200/80 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs"
        style={{ background: `${cor}15`, color: cor, border: `1px solid ${cor}30` }}
      >
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-barlow text-xl font-bold leading-tight text-gray-900">{titulo}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{texto}</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Formulário de Cadastro
   ═══════════════════════════════════════════════════════════════════ */

function FormularioCadastro({
  form, setForm, nome, cabe, caracteresInvalidos, escala, limite, enviando, erro, onSubmit,
}: any) {
  const campo =
    'mt-1.5 w-full rounded-xl border border-gray-300 bg-white p-3.5 text-base outline-none transition-all focus:border-[#d42b2b] focus:ring-4 focus:ring-[#d42b2b]/10 text-gray-900 font-medium'

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.12)]">
      <div>
        <h2 className="font-barlow text-3xl font-black text-gray-900">Faça o seu cadastro</h2>
        <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">
          Preencha os dados abaixo. O nome digitado na gravação será gravado a laser na sua caneca exclusiva no estande!
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Seu Nome Completo *
          </label>
          <input
            required value={form.nomeCompleto}
            onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })}
            className={campo} placeholder="Nome e sobrenome" autoComplete="name"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            WhatsApp (com DDD) *
          </label>
          <input
            required inputMode="tel" value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            className={campo} placeholder="(19) 99999-9999" autoComplete="tel"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Nome para Gravar na Caneca *
          </label>
          <input
            required maxLength={limite} value={form.nomeGravacao}
            onChange={(e) => setForm({ ...form, nomeGravacao: e.target.value })}
            className={`${campo} ${cabe ? '' : 'border-red-500 bg-red-50'}`}
            placeholder="Ex.: Maria Fernanda"
          />
        </div>
      </div>

      {/* Prévia da Gravação em Carbon Metallic Card */}
      <div className="overflow-hidden rounded-2xl bg-[#0f0f14] p-6 text-center text-white border border-white/10 shadow-inner">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: AMARELO }}>
          ⚡ Prévia da Gravação a Laser na Caneca
        </p>
        <p
          className="mt-4 whitespace-nowrap font-barlow font-black text-white tracking-wide"
          style={{ fontSize: `${Math.round(32 * escala)}px` }}
        >
          {nome || 'SEU NOME AQUI'}
        </p>
        <p className="mt-3 text-xs text-gray-400">
          {nome.length}/{limite} caracteres ·{' '}
          {cabe
            ? '✓ Tamanho ideal para uma linha'
            : caracteresInvalidos
              ? '⚠ Remova emojis ou símbolos especiais'
              : '⚠ Nome longo demais para uma única linha'}
        </p>
      </div>

      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 text-sm cursor-pointer text-gray-700">
          <input
            required type="checkbox" checked={form.confirmouNome}
            onChange={(e) => setForm({ ...form, confirmouNome: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#d42b2b] rounded-md"
          />
          <span>Confirmo que o nome da gravação está correto. A caneca será gravada exatamente como na prévia.</span>
        </label>

        <label className="flex items-start gap-3 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox" checked={form.consentimentoMarketing}
            onChange={(e) => setForm({ ...form, consentimentoMarketing: e.target.checked })}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#d42b2b] rounded-md"
          />
          <span>Quero receber ofertas exclusivas e convites para eventos da Forza Motos.</span>
        </label>
      </div>

      {erro && (
        <p className="flex gap-2.5 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-medium text-red-700">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      <button
        disabled={enviando || !cabe}
        className="w-full rounded-2xl py-4 font-barlow font-bold uppercase tracking-wider text-base text-white transition-all shadow-lg hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, ${VERMELHO} 0%, #b81d1d 100%)`,
          boxShadow: `0 12px 30px ${VERMELHO}44`,
        }}
      >
        {enviando ? 'Confirmando cadastro…' : '🔥 Confirmar meu Cadastro & Liberar Atrações'}
      </button>
    </form>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Painel do Visitante
   ═══════════════════════════════════════════════════════════════════ */

function PainelVisitante({
  nome, qr, erro, aviso, painel, setPainel, quiz, respostas, setRespostas,
  resultado, onEnviarQuiz, onCarregarQuiz, onParticipar, instagramSalvo,
}: any) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 text-center shadow-[0_20px_50px_-20px_rgba(0,0,0,0.12)]">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 shadow-xs">
          <CheckCircle2 size={32} />
        </div>
        <h2 className="font-barlow text-3xl font-black text-gray-900">Cadastro Confirmado!</h2>
        <p className="mt-1 text-sm text-gray-600">
          Nome para gravação da caneca: <strong className="text-gray-900">{nome}</strong>
        </p>

        {qr && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="mx-auto w-fit rounded-2xl bg-white p-4 ring-1 ring-gray-200 shadow-md">
              <img src={qr} alt="QR Code do Visitante" className="h-56 w-56 object-contain" />
            </div>
            <p className="mx-auto mt-4 flex max-w-sm items-center justify-center gap-2 text-xs font-medium text-gray-600">
              <QrCode size={16} className="shrink-0 text-[#d42b2b]" />
              Apresente este QR Code na equipe do stand para validar quiz e retirar sua caneca.
            </p>
          </div>
        )}
      </div>

      {aviso && <p className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-medium text-emerald-800">{aviso}</p>}
      {erro && <p className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm font-medium text-amber-900">{erro}</p>}

      {painel === 'quiz' && (
        <Quiz quiz={quiz} respostas={respostas} setRespostas={setRespostas} resultado={resultado} onEnviar={onEnviarQuiz} />
      )}
      {painel === 'foto' && <FormFoto instagramSalvo={instagramSalvo} onEnviar={onParticipar} onCancelar={() => setPainel(null)} />}
      {painel === 'balanceamento' && <FormBalanceamento onEnviar={onParticipar} onCancelar={() => setPainel(null)} />}

      {!painel && (
        <div className="space-y-3.5">
          <BotaoAtracao
            destaque cor={AMARELO} icone={<Trophy size={22} />}
            titulo="Fazer o Quiz de Pneus" texto="Acerte todas as perguntas e entre na fila da caneca gravada."
            onClick={() => { setPainel('quiz'); onCarregarQuiz() }}
          />
          <BotaoAtracao
            cor={VERMELHO} icone={<Camera size={22} />}
            titulo="Concurso de Foto no Stand" texto="Cadastre seu @ do Instagram para apuração das curtidas."
            onClick={() => setPainel('foto')}
          />
          <BotaoAtracao
            cor="#2f7d4f" icone={<Wrench size={22} />}
            titulo="Aprender Balanceamento na Prática" texto="Escolha o melhor período para aprender com os técnicos."
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
      className={`flex w-full items-center gap-4 sm:gap-5 rounded-2xl p-5 text-left transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${
        destaque ? 'bg-[#0f0f14] text-white shadow-lg' : 'border border-gray-200/80 bg-white shadow-sm hover:shadow-md'
      }`}
    >
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-xs"
        style={{ background: `${cor}22`, color: cor }}
      >
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-barlow text-xl font-bold leading-tight">{titulo}</span>
        <span className={`mt-1 block text-sm ${destaque ? 'text-gray-300' : 'text-gray-600'}`}>{texto}</span>
      </span>
      <ArrowRight size={20} className={destaque ? 'text-white/60' : 'text-gray-400'} />
    </button>
  )
}

/* ── Foto: Concurso ──────────────────────────────────────────────── */

function FormFoto({ instagramSalvo, onEnviar, onCancelar }: any) {
  const [instagram, setInstagram] = useState(instagramSalvo ?? '')
  const [marcou, setMarcou] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const handle = instagram.trim().replace(/^@/, '')

  return (
    <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
      <div>
        <h2 className="font-barlow text-3xl font-black text-gray-900">Concurso de Foto</h2>
        <p className="mt-1 text-sm text-gray-600 leading-relaxed">
          Poste a foto tirada no estande no Instagram marcando <b>@forzamotos</b>, <b>Pirelli</b> e{' '}
          <b>Campneus</b>. A equipe apura a foto mais curtida para a entrega do prêmio!
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
          Seu @ do Instagram
        </label>
        <div className="flex items-center rounded-xl border border-gray-300 bg-white focus-within:border-[#d42b2b] focus-within:ring-4 focus-within:ring-[#d42b2b]/10">
          <AtSign size={18} className="ml-3.5 shrink-0 text-gray-400" />
          <input
            value={instagram} onChange={(e) => setInstagram(e.target.value)}
            className="w-full bg-transparent p-3.5 pl-2 text-base text-gray-900 font-medium outline-none"
            placeholder="seu.perfil" autoCapitalize="none" autoCorrect="off"
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-sm text-gray-700 cursor-pointer pt-1">
        <input
          type="checkbox" checked={marcou} onChange={(e) => setMarcou(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#d42b2b] rounded-md"
        />
        <span>Já publiquei a foto no Instagram marcando as três marcas oficiais!</span>
      </label>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={onCancelar} className="rounded-xl border border-gray-300 py-3.5 font-bold text-gray-700 hover:bg-gray-50 transition-colors">
          Voltar
        </button>
        <button
          disabled={!handle || enviando}
          onClick={async () => { setEnviando(true); await onEnviar('foto', { instagram: handle, declarouMarcacoes: marcou }); setEnviando(false) }}
          className="rounded-xl py-3.5 font-bold text-white transition-all disabled:opacity-50 shadow-md"
          style={{ background: VERMELHO }}
        >
          {enviando ? 'Enviando…' : 'Participar do Concurso'}
        </button>
      </div>
    </div>
  )
}

/* ── Balanceamento: Oficina ──────────────────────────────────────── */

function FormBalanceamento({ onEnviar, onCancelar }: any) {
  const [horario, setHorario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const opcoes = ['Manhã', 'Início da tarde', 'Fim da tarde', 'Tanto faz']

  return (
    <div className="rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-4">
      <div>
        <h2 className="font-barlow text-3xl font-black text-gray-900">Aprenda a Balancear</h2>
        <p className="mt-1 text-sm text-gray-600 leading-relaxed">
          Nossos especialistas te ensinam na prática como funciona o balanceamento de pneus. Escolha a sua preferência de horário:
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {opcoes.map((o) => (
          <button
            key={o} onClick={() => setHorario(o)}
            className={`rounded-xl border py-3.5 text-sm font-semibold transition-all ${
              horario === o ? 'border-transparent text-white shadow-sm' : 'border-gray-200 text-gray-700 hover:border-gray-400'
            }`}
            style={horario === o ? { background: '#2f7d4f' } : undefined}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button onClick={onCancelar} className="rounded-xl border border-gray-300 py-3.5 font-bold text-gray-700 hover:bg-gray-50 transition-colors">
          Voltar
        </button>
        <button
          disabled={enviando}
          onClick={async () => { setEnviando(true); await onEnviar('balanceamento', { horario: horario || undefined }); setEnviando(false) }}
          className="rounded-xl py-3.5 font-bold text-white transition-all disabled:opacity-50 shadow-md"
          style={{ background: '#2f7d4f' }}
        >
          {enviando ? 'Enviando…' : 'Confirmar Presença'}
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
      <div className="rounded-3xl border border-gray-200/80 bg-white p-8 text-center shadow-sm space-y-4">
        <span
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm"
          style={{ background: ganhou ? `${AMARELO}25` : '#f2f2f0', color: ganhou ? '#b58900' : '#888' }}
        >
          {ganhou ? <Trophy size={32} /> : <Gift size={32} />}
        </span>
        <h2 className="font-barlow text-3xl font-black text-gray-900">
          {ganhou ? 'Você acertou todas!' : 'Quiz Concluído!'}
        </h2>
        <p className="text-base text-gray-600 max-w-sm mx-auto leading-relaxed">
          {ganhou
            ? 'Sua caneca personalizada já foi liberada na fila de gravação. Apresente seu QR Code no stand!'
            : `Você fez ${resultado.tentativa.pontuacao} de ${resultado.tentativa.pontuacaoMaxima} pontos. Obrigado por participar!`}
        </p>
      </div>
    )
  }

  if (!quiz) return <Cartao>Carregando quiz de pneus…</Cartao>
  if (quiz.tentativa) return <Cartao>Sua tentativa oficial já foi realizada. Mostre seu QR Code na equipe!</Cartao>
  if (!quiz.perguntas?.length) return <Cartao>O quiz está sendo configurado no sistema.</Cartao>

  const respondidas = Object.keys(respostas).length
  const total = quiz.perguntas.length

  return (
    <div className="space-y-6 rounded-3xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-sm">
      <div>
        <h2 className="font-barlow text-3xl font-black text-gray-900">Quiz de Pneus Pirelli</h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(respondidas / total) * 100}%`, background: VERMELHO }}
            />
          </div>
          <span className="text-xs font-bold tabular-nums text-gray-600">
            {respondidas}/{total} respondidas
          </span>
        </div>
      </div>

      {quiz.perguntas.map((pergunta: any, indice: number) => (
        <fieldset key={pergunta.id} className="space-y-3">
          <legend className="font-bold text-base text-gray-900 leading-snug">
            {indice + 1}. {pergunta.enunciado}
          </legend>
          <div className="space-y-2.5">
            {pergunta.opcoes.map((opcao: any) => {
              const marcada = respostas[pergunta.id] === opcao.id
              return (
                <label
                  key={opcao.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm font-medium transition-all ${
                    marcada ? 'border-[#d42b2b] bg-[#d42b2b]/[0.05] ring-2 ring-[#d42b2b]/10 text-gray-900' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio" name={pergunta.id} checked={marcada}
                    onChange={() => setRespostas({ ...respostas, [pergunta.id]: opcao.id })}
                    className="h-4 w-4 shrink-0 accent-[#d42b2b]"
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
        className="w-full rounded-2xl py-4 font-barlow font-bold uppercase tracking-wider text-base text-white transition-all shadow-md disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, ${VERMELHO} 0%, #b81d1d 100%)`,
          boxShadow: `0 12px 30px ${VERMELHO}44`,
        }}
      >
        {enviando ? 'Enviando respostas…' : 'Enviar Tentativa Oficial'}
      </button>
      <p className="-mt-3 text-center text-xs text-gray-500">
        Você possui 1 tentativa oficial. Revise suas escolhas antes de enviar.
      </p>
    </div>
  )
}

function Cartao({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-gray-200/80 bg-white p-8 text-center text-base font-medium text-gray-600 shadow-sm">
      {children}
    </div>
  )
}
