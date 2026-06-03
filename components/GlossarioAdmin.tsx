'use client'

import { useState, useCallback } from 'react'
import {
  BookOpen, Plus, Search, Bot, Sparkles, Trash2,
  Loader2, CheckCircle2, AlertCircle, ExternalLink, Eye,
  ChevronDown, ChevronUp, Pencil, Check, X, Settings, Key,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ── Providers disponíveis ─────────────────────────────────────────────────────
const PROVIDERS = [
  { id: 'gemini',     label: 'Gemini (Google)',    modelos: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'openai',     label: 'OpenAI',             modelos: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'] },
  { id: 'anthropic',  label: 'Anthropic (Claude)', modelos: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'] },
  { id: 'openrouter', label: 'OpenRouter',          modelos: ['openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct'] },
  { id: 'groq',       label: 'Groq (rápido)',       modelos: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'] },
  { id: 'deepseek',   label: 'DeepSeek',            modelos: ['deepseek-chat', 'deepseek-reasoner'] },
]

// ── Config de IA ──────────────────────────────────────────────────────────────
interface IAConfig {
  provider:  string
  modelo:    string
  maxTokens: number
  apiKey:    string
}

const IA_DEFAULT: IAConfig = {
  provider:  'gemini',
  modelo:    'gemini-2.0-flash',
  maxTokens: 4096,
  apiKey:    '',
}

const LS_KEY = 'forza_ia_config'

function loadIAConfig(): IAConfig {
  if (typeof window === 'undefined') return IA_DEFAULT
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) return { ...IA_DEFAULT, ...JSON.parse(saved) }
  } catch {}
  return IA_DEFAULT
}

function saveIAConfig(config: IAConfig) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(config)) } catch {}
}

// ── Painel de configuração de IA ──────────────────────────────────────────────
function PainelIA({ config, onChange }: { config: IAConfig; onChange: (c: IAConfig) => void }) {
  const [aberto,  setAberto]  = useState(false)
  const [salvo,   setSalvo]   = useState(false)
  const providerAtual = PROVIDERS.find((p) => p.id === config.provider) ?? PROVIDERS[0]

  function handleSalvar() {
    saveIAConfig(config)
    setSalvo(true)
    setTimeout(() => setSalvo(false), 2000)
  }

  return (
    <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-brand-text hover:bg-white/[0.02] transition-colors"
      >
        <span className="flex items-center gap-2">
          <Settings size={14} className="text-brand-accent" />
          Configurações de IA
          <span className="text-brand-muted font-normal text-xs">
            ({providerAtual.label} · {config.modelo} · {config.maxTokens} tokens)
          </span>
        </span>
        {aberto ? <ChevronUp size={14} className="text-brand-muted" /> : <ChevronDown size={14} className="text-brand-muted" />}
      </button>

      {aberto && (
        <div className="px-5 pb-5 space-y-4 border-t border-brand-border/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">

            {/* Provider */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Provider</label>
              <select
                value={config.provider}
                onChange={(e) => {
                  const prov = PROVIDERS.find((p) => p.id === e.target.value)!
                  onChange({ ...config, provider: e.target.value, modelo: prov.modelos[0] })
                }}
                className="w-full bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent/50 transition-colors"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Modelo */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Modelo</label>
              <select
                value={config.modelo}
                onChange={(e) => onChange({ ...config, modelo: e.target.value })}
                className="w-full bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent/50 transition-colors"
              >
                {providerAtual.modelos.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {/* Campo livre para modelo custom */}
                <option value="__custom__">Outro (digitar abaixo)</option>
              </select>
            </div>

            {/* Modelo custom */}
            {config.modelo === '__custom__' && (
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Modelo customizado</label>
                <input
                  type="text"
                  placeholder="Ex: meta-llama/llama-3.3-70b-instruct"
                  onChange={(e) => onChange({ ...config, modelo: e.target.value || '__custom__' })}
                  className="w-full bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent/50 transition-colors"
                />
              </div>
            )}

            {/* Max tokens */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider flex justify-between">
                <span>Tokens máximos</span>
                <span className="text-brand-accent font-mono">{config.maxTokens.toLocaleString()}</span>
              </label>
              <input
                type="range" min={512} max={8192} step={256}
                value={config.maxTokens}
                onChange={(e) => onChange({ ...config, maxTokens: Number(e.target.value) })}
                className="w-full accent-brand-accent"
              />
              <div className="flex justify-between text-[9px] text-brand-muted">
                <span>512 (rápido)</span><span>4096 (padrão)</span><span>8192 (longo)</span>
              </div>
            </div>

            {/* API Key */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider flex items-center gap-1.5">
                <Key size={10} />
                API Key (opcional — usa .env se vazio)
              </label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
                placeholder="sk-... ou AIza..."
                className="w-full bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent/50 transition-colors font-mono"
              />
              <p className="text-[9px] text-brand-muted">Se vazio, usa a chave configurada nas variáveis de ambiente do servidor.</p>
            </div>
          </div>

          {/* Botão salvar */}
          <div className="flex items-center justify-between pt-2 border-t border-brand-border/20">
            <p className="text-[10px] text-brand-muted">
              Configurações salvas localmente no navegador (não vão para o banco).
            </p>
            <button
              onClick={handleSalvar}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: salvo ? 'rgba(34,197,94,0.15)' : 'var(--brand-accent, #d42b2b)',
                color:      salvo ? '#16a34a' : '#fff',
                border:     salvo ? '1px solid rgba(34,197,94,0.30)' : 'none',
              }}
            >
              {salvo
                ? <><Check size={14} /> Salvo!</>
                : <><Key size={14} /> Salvar configurações</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface Termo {
  id: string
  termo: string
  slug: string
  letra: string
  nicho: string | null
  categoria: string | null
  publicado: boolean
  revisado: boolean
  origem: string
  seoTitle: string | null
  resumo: string | null
  views: number
  createdAt: string
}

interface Props {
  defaultNicho?: string
  siteUrl?: string
  initialTermos: Termo[]
}

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const PREFIXOS = [
  'Nenhum',
  'O que é',
  'Como funciona',
  'Para que serve',
  'Qual o melhor',
  'Como escolher',
  'Onde encontrar',
]

// ── Helpers visuais ───────────────────────────────────────────────────────────
function StatusBadge({ publicado, revisado }: { publicado: boolean; revisado: boolean }) {
  if (publicado) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <CheckCircle2 size={10} /> Publicado
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
      <AlertCircle size={10} /> {revisado ? 'Revisado' : 'Pendente'}
    </span>
  )
}

function OrigemBadge({ origem }: { origem: string }) {
  const map: Record<string, string> = {
    MANUAL:    'bg-white/5 text-brand-muted border-brand-border/30',
    AI_GEMINI: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    AI_OPENAI: 'bg-green-500/10 text-green-400 border-green-500/20',
    CSV_IMPORT:'bg-purple-500/10 text-purple-400 border-purple-500/20',
  }
  const labels: Record<string, string> = {
    MANUAL: 'Manual', AI_GEMINI: '✨ IA', AI_OPENAI: '✨ IA', CSV_IMPORT: '📤 CSV',
  }
  const cls = map[origem] || map.MANUAL
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-medium border ${cls}`}>{labels[origem] || origem}</span>
}

// ── Componente principal ──────────────────────────────────────────────────────
export function GlossarioAdmin({ initialTermos, defaultNicho = '', siteUrl = '' }: Props) {
  const [termos,      setTermos]     = useState<Termo[]>(initialTermos)
  const [iaConfig,    setIaConfig]   = useState<IAConfig>(loadIAConfig)
  const [nicho,       setNicho]      = useState(defaultNicho || '')
  const [letraSugerir,setLetraSugerir] = useState('A')
  const [prefixo,     setPrefixo]    = useState('Nenhum')
  const [promptExtra, setPromptExtra]= useState('')
  const [novoTermo,   setNovoTermo]  = useState('')

  // Edição inline
  const [editingId,    setEditingId]   = useState<string | null>(null)
  const [editingTermo, setEditingTermo]= useState('')
  const [editingNicho, setEditingNicho]= useState('')

  // Filtros
  const [busca,       setBusca]      = useState('')
  const [letraFiltro, setLetraFiltro]= useState<string | null>(null)
  const [statusFiltro,setStatusFiltro]=useState<'todos'|'pendente'|'publicado'>('todos')

  // Loadings
  const [loadingSugerir, setLoadingSugerir] = useState(false)
  const [loadingManual,  setLoadingManual]  = useState(false)
  const [loadingAcao,    setLoadingAcao]    = useState<string | null>(null)

  // Lote
  const [selectedIds,       setSelectedIds]       = useState<string[]>([])
  const [isGeneratingBulk,  setIsGeneratingBulk]  = useState(false)
  const [bulkTotal,         setBulkTotal]          = useState(0)
  const [bulkCurrent,       setBulkCurrent]        = useState(0)
  const [bulkTermoAtual,    setBulkTermoAtual]     = useState('')

  // Painel de gerador colapsável
  const [geradorAberto, setGeradorAberto] = useState(true)

  // ── Refresh ──────────────────────────────────────────────────────────────────
  const refreshList = useCallback(async () => {
    const res = await fetch('/api/glossario')
    if (res.ok) setTermos(await res.json())
  }, [])

  // ── Sugerir termos via IA ─────────────────────────────────────────────────────
  async function handleSugerirTermos() {
    if (!nicho.trim()) { toast.error('Informe o nicho'); return }
    setLoadingSugerir(true)
    try {
      const res  = await fetch('/api/glossario/gerar-termos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicho, letra: letraSugerir, prefixo, promptExtra,
          provider:  iaConfig.provider,
          modelo:    iaConfig.modelo === '__custom__' ? '' : iaConfig.modelo,
          maxTokens: iaConfig.maxTokens,
          apiKey:    iaConfig.apiKey || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`IA sugeriu ${data.totalSugeridos} termos (${data.totalInseridos} novos adicionados)`)
      setPromptExtra('')
      await refreshList()
    } catch (e: any) {
      toast.error(e.message || 'Erro ao sugerir termos')
    } finally {
      setLoadingSugerir(false)
    }
  }

  // ── Adicionar manual ──────────────────────────────────────────────────────────
  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault()
    if (!novoTermo.trim()) return
    setLoadingManual(true)
    try {
      const res  = await fetch('/api/glossario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ termo: novoTermo.trim(), letra: novoTermo.trim().charAt(0), nicho }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`"${data.termo}" cadastrado!`)
      setNovoTermo('')
      await refreshList()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingManual(false)
    }
  }

  // ── Salvar edição inline ───────────────────────────────────────────────────────
  async function handleSaveEdit(id: string) {
    if (!editingTermo.trim()) { toast.error('Termo não pode ser vazio'); return }
    setLoadingAcao(id)
    try {
      const res = await fetch('/api/glossario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, termo: editingTermo.trim(), nicho: editingNicho.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Verbete atualizado!')
      setEditingId(null)
      await refreshList()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingAcao(null)
    }
  }

  // ── Gerar definição de 1 termo ────────────────────────────────────────────────
  async function handleGerarDefinicao(id: string, nome: string) {
    setLoadingAcao(id)
    try {
      const res  = await fetch('/api/glossario/gerar-conteudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          provider:  iaConfig.provider,
          modelo:    iaConfig.modelo === '__custom__' ? '' : iaConfig.modelo,
          maxTokens: iaConfig.maxTokens,
          apiKey:    iaConfig.apiKey || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Definição de "${nome}" gerada e publicada!`)
      await refreshList()
    } catch (e: any) {
      toast.error(`Erro em "${nome}": ${e.message}`)
    } finally {
      setLoadingAcao(null)
    }
  }

  // ── Excluir ───────────────────────────────────────────────────────────────────
  async function handleExcluir(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"?`)) return
    setLoadingAcao(id)
    try {
      const res = await fetch('/api/glossario', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`"${nome}" excluído`)
      setSelectedIds((s) => s.filter((x) => x !== id))
      await refreshList()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoadingAcao(null)
    }
  }

  // ── Geração em LOTE ────────────────────────────────────────────────────────────
  async function handleGerarLote() {
    const pendentes = termos.filter((t) => selectedIds.includes(t.id) && !t.publicado)
    if (pendentes.length === 0) { toast.error('Nenhum pendente selecionado'); return }

    setIsGeneratingBulk(true)
    setBulkTotal(pendentes.length)
    setBulkCurrent(0)

    let ok = 0
    for (const t of pendentes) {
      setBulkTermoAtual(t.termo)
      try {
        const res = await fetch('/api/glossario/gerar-conteudo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: t.id,
            provider:  iaConfig.provider,
            modelo:    iaConfig.modelo === '__custom__' ? '' : iaConfig.modelo,
            maxTokens: iaConfig.maxTokens,
            apiKey:    iaConfig.apiKey || undefined,
          }),
        })
        if (res.ok) ok++
      } catch {}
      setBulkCurrent((c) => c + 1)
    }

    await refreshList()
    setIsGeneratingBulk(false)
    setSelectedIds([])
    toast.success(`Lote concluído! ${ok}/${pendentes.length} termos publicados.`)
  }

  // ── Seleção ───────────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  const toggleSelectAll = (lista: Termo[]) => {
    const ids = lista.map((t) => t.id)
    const allSelected = ids.every((id) => selectedIds.includes(id))
    setSelectedIds(allSelected ? selectedIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedIds, ...ids])))
  }

  // ── Filtros aplicados ─────────────────────────────────────────────────────────
  const filteredTermos = termos.filter((t) => {
    if (busca && !t.termo.toLowerCase().includes(busca.toLowerCase()) && !(t.nicho?.toLowerCase().includes(busca.toLowerCase()))) return false
    if (letraFiltro && t.letra !== letraFiltro) return false
    if (statusFiltro === 'publicado' && !t.publicado) return false
    if (statusFiltro === 'pendente'  &&  t.publicado) return false
    return true
  })

  return (
    <div className="space-y-6">

      {/* ── Configurações de IA ── */}
      <PainelIA config={iaConfig} onChange={setIaConfig} />

      {/* ── Barra de progresso do lote ── */}
      {isGeneratingBulk && (
        <div className="admin-glass !bg-black/30 border border-brand-accent/30 rounded-2xl p-4">
          <div className="h-1 bg-brand-border rounded-full overflow-hidden mb-3">
            <div className="h-full bg-brand-accent transition-all duration-300 rounded-full" style={{ width: `${(bulkCurrent / bulkTotal) * 100}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-brand-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-brand-accent" />
              Gerando <span className="text-brand-text font-semibold">"{bulkTermoAtual}"</span>
            </span>
            <span className="font-mono font-bold text-brand-text">
              {bulkCurrent}/{bulkTotal} ({Math.round((bulkCurrent / bulkTotal) * 100)}%)
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Coluna esquerda — Gerador ── */}
        <div className="lg:col-span-4 space-y-4">

          {/* Card Gerador Ninja */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden">
            <button
              onClick={() => setGeradorAberto((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-brand-text hover:bg-white/[0.02] transition-colors"
            >
              <span className="flex items-center gap-2">
                <Bot size={15} className="text-brand-accent" />
                Gerador Ninja via IA
              </span>
              {geradorAberto ? <ChevronUp size={14} className="text-brand-muted" /> : <ChevronDown size={14} className="text-brand-muted" />}
            </button>

            {geradorAberto && (
              <div className="px-5 pb-5 space-y-3 border-t border-brand-border/20">
                <p className="text-xs text-brand-muted pt-3">Sugere até 30 novos verbetes por letra baseados no nicho.</p>

                {/* Nicho */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Nicho / Segmento</label>
                  <input type="text" value={nicho} onChange={(e) => setNicho(e.target.value)}
                    className="w-full bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent/50 transition-colors"
                    placeholder="pneus, peças e acessórios para motos" />
                </div>

                {/* Prefixo */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Estilo do Título</label>
                  <select value={prefixo} onChange={(e) => setPrefixo(e.target.value)}
                    className="w-full bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2.5 text-brand-text text-sm focus:outline-none focus:border-brand-accent/50 transition-colors">
                    {PREFIXOS.map((p) => (
                      <option key={p} value={p}>{p === 'Nenhum' ? 'Nenhum (só o termo)' : `${p}...`}</option>
                    ))}
                  </select>
                </div>

                {/* Seletor de letra A-Z */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Letra ({letraSugerir})</label>
                  <div className="grid grid-cols-7 gap-1">
                    {ALFABETO.map((l) => (
                      <button key={l} type="button" onClick={() => setLetraSugerir(l)}
                        className={`h-8 text-[11px] font-bold rounded-lg border transition-all duration-150 ${
                          letraSugerir === l
                            ? 'bg-brand-accent border-brand-accent text-white scale-105 shadow-sm shadow-brand-accent/30'
                            : 'border-brand-border/30 text-brand-muted hover:border-brand-accent/40 hover:text-brand-text'
                        }`}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* Prompt extra */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Instruções Extras (opcional)</label>
                  <textarea value={promptExtra} onChange={(e) => setPromptExtra(e.target.value)} rows={2}
                    className="w-full bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2 text-brand-text text-xs focus:outline-none focus:border-brand-accent/50 transition-colors resize-none"
                    placeholder="Ex: foco em pneus off-road, termos técnicos..." />
                </div>

                <button onClick={handleSugerirTermos} disabled={loadingSugerir || isGeneratingBulk}
                  className="w-full flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent/90 disabled:opacity-50 text-white font-bold text-sm py-2.5 rounded-xl transition-colors">
                  {loadingSugerir ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {loadingSugerir ? 'Gerando...' : 'Sugerir Verbetes'}
                </button>
              </div>
            )}
          </div>

          {/* Card Cadastro Manual */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <Plus size={14} className="text-brand-accent" /> Cadastro Manual
            </h3>
            <form onSubmit={handleAddManual} className="flex gap-2">
              <input type="text" value={novoTermo} onChange={(e) => setNovoTermo(e.target.value)}
                className="flex-1 bg-white/5 border border-brand-border/40 rounded-xl px-3 py-2 text-brand-text text-sm focus:outline-none focus:border-brand-accent/50 transition-colors"
                placeholder="Nome do termo..." />
              <button type="submit" disabled={loadingManual || !novoTermo.trim() || isGeneratingBulk}
                className="flex items-center gap-1.5 bg-white/5 border border-brand-border/40 hover:border-brand-accent/40 disabled:opacity-50 text-brand-text font-bold text-sm px-3 py-2 rounded-xl transition-colors">
                {loadingManual ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              </button>
            </form>
          </div>
        </div>

        {/* ── Coluna direita — Tabela ── */}
        <div className="lg:col-span-8 space-y-3">

          {/* Filtros */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Busca */}
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                  className="w-full bg-white/5 border border-brand-border/40 rounded-xl pl-8 pr-3 py-2 text-brand-text text-sm placeholder:text-brand-muted focus:outline-none focus:border-brand-accent/50 transition-colors"
                  placeholder="Buscar termo ou nicho..." />
              </div>
              {/* Status */}
              <div className="flex border border-brand-border/30 rounded-xl overflow-hidden shrink-0">
                {(['todos', 'pendente', 'publicado'] as const).map((s) => (
                  <button key={s} onClick={() => setStatusFiltro(s)}
                    className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      statusFiltro === s ? 'bg-brand-accent text-white' : 'text-brand-muted hover:text-brand-text hover:bg-white/5'
                    }`}>
                    {s === 'todos' ? 'Todos' : s === 'pendente' ? 'Pendente' : 'Publicado'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtro A-Z */}
            <div className="flex flex-wrap gap-1 pt-1 border-t border-brand-border/20">
              <button onClick={() => setLetraFiltro(null)}
                className={`h-6 px-2.5 text-[10px] font-bold rounded-lg uppercase transition-all ${
                  letraFiltro === null ? 'bg-brand-accent text-white' : 'bg-white/5 text-brand-muted hover:text-brand-text border border-brand-border/30'
                }`}>Tudo</button>
              {ALFABETO.map((l) => {
                const count = termos.filter((t) => t.letra === l).length
                if (!count) return null
                return (
                  <button key={l} onClick={() => setLetraFiltro(l)}
                    className={`h-6 px-2 text-[10px] font-bold rounded-lg uppercase transition-all flex items-center gap-1 ${
                      letraFiltro === l ? 'bg-brand-accent text-white' : 'bg-white/5 text-brand-muted hover:text-brand-text border border-brand-border/30'
                    }`}>
                    {l}
                    <span className="text-[9px] opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Barra de ações em lote */}
          {selectedIds.length > 0 && (
            <div className="admin-glass !bg-black/30 border border-brand-accent/20 rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-brand-muted">
                <span className="text-brand-text font-bold">{selectedIds.length}</span> selecionados
              </span>
              <div className="flex gap-2">
                <button onClick={handleGerarLote} disabled={isGeneratingBulk}
                  className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  <Sparkles size={12} /> Gerar Definições
                </button>
                <button onClick={() => setSelectedIds([])} className="text-brand-muted hover:text-brand-text text-xs px-2">
                  Limpar
                </button>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-brand-border/20 bg-white/[0.01]">
                  <tr className="text-[10px] text-brand-muted uppercase tracking-widest">
                    <th className="px-4 py-3 w-10 text-center">
                      <input type="checkbox"
                        checked={filteredTermos.length > 0 && filteredTermos.every((t) => selectedIds.includes(t.id))}
                        onChange={() => toggleSelectAll(filteredTermos)}
                        className="rounded border-brand-border cursor-pointer accent-brand-accent" />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Termo</th>
                    <th className="px-4 py-3 text-left font-medium w-16 text-center">Letra</th>
                    <th className="px-4 py-3 text-left font-medium w-20 hidden sm:table-cell">Origem</th>
                    <th className="px-4 py-3 text-left font-medium w-24">Status</th>
                    <th className="px-4 py-3 text-right font-medium w-40">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/10">
                  {filteredTermos.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-brand-muted">
                        <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhum verbete encontrado</p>
                      </td>
                    </tr>
                  )}
                  {filteredTermos.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)}
                          className="rounded border-brand-border cursor-pointer accent-brand-accent" />
                      </td>
                      <td className="px-4 py-3">
                        {editingId === t.id ? (
                          <div className="space-y-1.5">
                            <input value={editingTermo} onChange={(e) => setEditingTermo(e.target.value)}
                              className="w-full bg-white/5 border border-brand-accent/40 rounded-lg px-2 py-1 text-brand-text text-sm focus:outline-none"
                              autoFocus />
                            <input value={editingNicho} onChange={(e) => setEditingNicho(e.target.value)}
                              className="w-full bg-white/5 border border-brand-border/30 rounded-lg px-2 py-1 text-brand-muted text-xs focus:outline-none"
                              placeholder="Nicho..." />
                          </div>
                        ) : (
                          <div>
                            <span className="font-medium text-brand-text">{t.termo}</span>
                            {t.nicho && <p className="text-[10px] text-brand-muted mt-0.5 truncate max-w-[200px]">{t.nicho}</p>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-accent/10 text-brand-accent text-[11px] font-bold border border-brand-accent/20">
                          {t.letra}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <OrigemBadge origem={t.origem} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge publicado={t.publicado} revisado={t.revisado} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editingId === t.id ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleSaveEdit(t.id)} disabled={loadingAcao === t.id}
                              className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors">
                              {loadingAcao === t.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Salvar
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="text-brand-muted hover:text-brand-text text-xs px-2 py-1 rounded-lg">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Editar */}
                            <button onClick={() => { setEditingId(t.id); setEditingTermo(t.termo); setEditingNicho(t.nicho || '') }}
                              title="Editar" className="p-1.5 text-brand-muted hover:text-brand-accent transition-colors rounded-lg hover:bg-white/5">
                              <Pencil size={13} />
                            </button>
                            {/* Gerar */}
                            {!t.publicado && (
                              <button onClick={() => handleGerarDefinicao(t.id, t.termo)} disabled={loadingAcao === t.id || isGeneratingBulk}
                                title="Gerar definição via IA"
                                className="flex items-center gap-1 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 hover:bg-brand-accent/20 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50">
                                {loadingAcao === t.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                                Gerar
                              </button>
                            )}
                            {/* Ver */}
                            {t.publicado && (
                              <a href={`/glossario/${t.slug}`} target="_blank" title="Ver no site"
                                className="p-1.5 text-brand-muted hover:text-brand-accent transition-colors rounded-lg hover:bg-white/5">
                                <ExternalLink size={13} />
                              </a>
                            )}
                            {/* Views */}
                            {t.views > 0 && (
                              <span className="text-[10px] text-brand-muted flex items-center gap-0.5">
                                <Eye size={10} /> {t.views}
                              </span>
                            )}
                            {/* Excluir */}
                            <button onClick={() => handleExcluir(t.id, t.termo)} disabled={loadingAcao === t.id}
                              title="Excluir" className="p-1.5 text-brand-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-brand-border/10 text-[10px] text-brand-muted">
              {filteredTermos.length} de {termos.length} termos
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
