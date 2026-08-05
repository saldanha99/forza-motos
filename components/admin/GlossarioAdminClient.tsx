'use client'

import { useState, useCallback } from 'react'
import {
  BookOpen, Plus, Search, Bot, Sparkles, Trash2,
  Loader2, CheckCircle2, AlertCircle, ExternalLink, Eye,
  ChevronDown, ChevronUp, Pencil, Check, X, Settings, Key,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import type { TomStatus } from '@/lib/admin/status'
import {
  Badge, BOTAO_TAMANHO, BOTAO_VARIANTE, Botao,
  Card, EmptyState, Tabela, THEAD_TH, TD_CELULA, BOTAO_BASE,
} from '@/components/admin/ui/primitives'

import { Campo, GrupoOpcoes, Input, Select, Textarea } from '@/components/admin/ui/form'

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
    <Card className="overflow-hidden">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-brand-text hover:bg-brand-tint-1 transition-colors"
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
        <div className="px-5 pb-5 space-y-4 border-t border-brand-hair">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">

            {/* Provider */}
            <Campo label="Provider">
              <Select
                value={config.provider}
                onChange={(e) => {
                  const prov = PROVIDERS.find((p) => p.id === e.target.value)!
                  onChange({ ...config, provider: e.target.value, modelo: prov.modelos[0] })
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </Campo>

            {/* Modelo */}
            <Campo label="Modelo">
              <Select
                value={config.modelo}
                onChange={(e) => onChange({ ...config, modelo: e.target.value })}
              >
                {providerAtual.modelos.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {/* Campo livre para modelo custom */}
                <option value="__custom__">Outro (digitar abaixo)</option>
              </Select>
            </Campo>

            {/* Modelo custom */}
            {config.modelo === '__custom__' && (
              <Campo label="Modelo customizado" className="sm:col-span-2">
                <Input
                  type="text"
                  placeholder="Ex: meta-llama/llama-3.3-70b-instruct"
                  onChange={(e) => onChange({ ...config, modelo: e.target.value || '__custom__' })}
                />
              </Campo>
            )}

            {/* Max tokens */}
            <Campo
              label="Tokens máximos"
              dica="512 (rápido) · 4096 (padrão) · 8192 (longo)"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-brand-muted">
                  <span>Valor atual</span>
                  <span className="text-brand-accent font-mono">{config.maxTokens.toLocaleString()}</span>
                </div>
                <input
                  type="range" min={512} max={8192} step={256}
                  value={config.maxTokens}
                  onChange={(e) => onChange({ ...config, maxTokens: Number(e.target.value) })}
                  className="w-full accent-brand-accent"
                />
              </div>
            </Campo>

            {/* API Key */}
            <Campo
              label="API Key (opcional)"
              dica="Se vazio, usa a chave configurada nas variáveis de ambiente do servidor."
            >
              <Input
                type="password"
                value={config.apiKey}
                onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
                placeholder="sk-... ou AIza..."
                className="font-mono"
              />
            </Campo>
          </div>

          {/* Botão salvar */}
          <div className="flex items-center justify-between pt-2 border-t border-brand-hair">
            <p className="text-[10px] text-brand-muted">
              Configurações salvas localmente no navegador (não vão para o banco).
            </p>
            <button
              onClick={handleSalvar}
              className={cn(
                BOTAO_BASE, BOTAO_TAMANHO.md,
                salvo ? 'bg-brand-success-soft text-brand-success' : BOTAO_VARIANTE.primario,
              )}
            >
              {salvo
                ? <><Check size={14} /> Salvo!</>
                : <><Key size={14} /> Salvar configurações</>
              }
            </button>
          </div>
        </div>
      )}
    </Card>
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
    <Badge tom="success">
      <CheckCircle2 size={10} /> Publicado
    </Badge>
  )
  return (
    <Badge tom="warning">
      <AlertCircle size={10} /> {revisado ? 'Revisado' : 'Pendente'}
    </Badge>
  )
}

const ORIGEM_TOM: Record<string, TomStatus> = {
  MANUAL:     'neutro',
  AI_GEMINI:  'info',
  AI_OPENAI:  'info',
  CSV_IMPORT: 'accent',
}

const ORIGEM_LABEL: Record<string, string> = {
  MANUAL: 'Manual', AI_GEMINI: '✨ IA', AI_OPENAI: '✨ IA', CSV_IMPORT: '📤 CSV',
}

function OrigemBadge({ origem }: { origem: string }) {
  return (
    <Badge tom={ORIGEM_TOM[origem] ?? 'neutro'}>
      {ORIGEM_LABEL[origem] ?? origem}
    </Badge>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function GlossarioAdminClient({ initialTermos }: Props) {
  const [termos,      setTermos]     = useState<Termo[]>(initialTermos)
  const [iaConfig,    setIaConfig]   = useState<IAConfig>(loadIAConfig)
  const [nicho,       setNicho]      = useState('pneus, peças e acessórios para motos')
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
        <Card className="border-brand-accent p-4">
          <div className="h-1 bg-brand-border rounded-full overflow-hidden mb-3">
            <div className="h-full bg-brand-accent transition duration-300 rounded-full" style={{ width: `${(bulkCurrent / bulkTotal) * 100}%` }} />
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
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* ── Coluna esquerda — Gerador ── */}
        <div className="lg:col-span-4 space-y-4">

          {/* Card Gerador Ninja */}
          <Card className="overflow-hidden">
            <button
              onClick={() => setGeradorAberto((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-brand-text hover:bg-brand-tint-1 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Bot size={15} className="text-brand-accent" />
                Gerador Ninja via IA
              </span>
              {geradorAberto ? <ChevronUp size={14} className="text-brand-muted" /> : <ChevronDown size={14} className="text-brand-muted" />}
            </button>

            {geradorAberto && (
              <div className="px-5 pb-5 space-y-3 border-t border-brand-hair">
                <p className="text-xs text-brand-muted pt-3">Sugere até 100 novos verbetes por letra baseados no nicho.</p>

                {/* Nicho */}
                <Campo label="Nicho / Segmento">
                  <Input type="text" value={nicho} onChange={(e) => setNicho(e.target.value)}
                    placeholder="pneus, peças e acessórios para motos" />
                </Campo>

                {/* Prefixo */}
                <Campo label="Estilo do Título">
                  <Select value={prefixo} onChange={(e) => setPrefixo(e.target.value)}>
                    {PREFIXOS.map((p) => (
                      <option key={p} value={p}>{p === 'Nenhum' ? 'Nenhum (só o termo)' : `${p}...`}</option>
                    ))}
                  </Select>
                </Campo>

                {/* Seletor de letra A-Z */}
                <Campo label={`Letra (${letraSugerir})`}>
                  <div className="grid grid-cols-7 gap-1">
                    {ALFABETO.map((l) => (
                      <button key={l} type="button" onClick={() => setLetraSugerir(l)}
                        className={cn(
                          'h-8 text-[11px] font-bold rounded-lg border transition duration-150',
                          letraSugerir === l
                            ? 'bg-brand-accent border-brand-accent text-brand-on-accent scale-105 shadow-cta'
                            : 'border-brand-border text-brand-muted hover:border-brand-accent hover:text-brand-text',
                        )}>{l}</button>
                    ))}
                  </div>
                </Campo>

                {/* Prompt extra */}
                <Campo label="Instruções Extras (opcional)">
                  <Textarea value={promptExtra} onChange={(e) => setPromptExtra(e.target.value)} rows={2}
                    className="min-h-0 resize-none text-xs"
                    placeholder="Ex: foco em pneus off-road, termos técnicos..." />
                </Campo>

                <Botao onClick={handleSugerirTermos} disabled={loadingSugerir || isGeneratingBulk} className="w-full">
                  {loadingSugerir ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {loadingSugerir ? 'Gerando...' : 'Sugerir Verbetes'}
                </Botao>
              </div>
            )}
          </Card>

          {/* Card Cadastro Manual */}
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-brand-text flex items-center gap-2">
              <Plus size={14} className="text-brand-accent" /> Cadastro Manual
            </h3>
            <form onSubmit={handleAddManual} className="flex gap-2 items-end">
              <Campo label="Novo termo" className="flex-1">
                <Input type="text" value={novoTermo} onChange={(e) => setNovoTermo(e.target.value)}
                  placeholder="Nome do termo..." />
              </Campo>
              <Botao type="submit" variante="secundario" disabled={loadingManual || !novoTermo.trim() || isGeneratingBulk}>
                {loadingManual ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              </Botao>
            </form>
          </Card>
        </div>

        {/* ── Coluna direita — Tabela ── */}
        <div className="lg:col-span-8 space-y-3">

          {/* Filtros */}
          <Card className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Busca */}
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <Input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
                  className="pl-8"
                  placeholder="Buscar termo ou nicho..." />
              </div>
              {/* Status */}
              <GrupoOpcoes
                valor={statusFiltro}
                onChange={setStatusFiltro}
                className="shrink-0"
                opcoes={[
                  { valor: 'todos', label: 'Todos' },
                  { valor: 'pendente', label: 'Pendente' },
                  { valor: 'publicado', label: 'Publicado' },
                ]}
              />
            </div>

            {/* Filtro A-Z */}
            <div className="flex flex-wrap gap-1 pt-1 border-t border-brand-hair">
              <button onClick={() => setLetraFiltro(null)}
                className={cn(
                  'h-6 px-2.5 text-[10px] font-bold rounded-lg uppercase transition',
                  letraFiltro === null
                    ? 'bg-brand-accent text-brand-on-accent'
                    : 'border border-brand-border bg-brand-surface-2 text-brand-muted hover:text-brand-text',
                )}>Tudo</button>
              {ALFABETO.map((l) => {
                const count = termos.filter((t) => t.letra === l).length
                if (!count) return null
                return (
                  <button key={l} onClick={() => setLetraFiltro(l)}
                    className={cn(
                      'h-6 px-2 text-[10px] font-bold rounded-lg uppercase transition flex items-center gap-1',
                      letraFiltro === l
                        ? 'bg-brand-accent text-brand-on-accent'
                        : 'border border-brand-border bg-brand-surface-2 text-brand-muted hover:text-brand-text',
                    )}>
                    {l}
                    <span className="text-[9px] opacity-70">{count}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Barra de ações em lote */}
          {selectedIds.length > 0 && (
            <Card className="border-brand-accent px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-brand-muted">
                <span className="text-brand-text font-bold">{selectedIds.length}</span> selecionados
              </span>
              <div className="flex gap-2">
                <button onClick={handleGerarLote} disabled={isGeneratingBulk}
                  className="flex items-center gap-1.5 bg-brand-success-soft text-brand-success hover:brightness-95 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  <Sparkles size={12} /> Gerar Definições
                </button>
                <button onClick={() => setSelectedIds([])} className="text-brand-muted hover:text-brand-text text-xs px-2">
                  Limpar
                </button>
              </div>
            </Card>
          )}

          {/* Tabela */}
          <Tabela
            cabecalho={
              <>
                <th className={cn(THEAD_TH, 'w-10 text-center')}>
                  <input type="checkbox"
                    checked={filteredTermos.length > 0 && filteredTermos.every((t) => selectedIds.includes(t.id))}
                    onChange={() => toggleSelectAll(filteredTermos)}
                    className="rounded border-brand-border cursor-pointer accent-brand-accent" />
                </th>
                <th className={THEAD_TH}>Termo</th>
                <th className={cn(THEAD_TH, 'w-16 text-center')}>Letra</th>
                <th className={cn(THEAD_TH, 'w-20 hidden sm:table-cell')}>Origem</th>
                <th className={cn(THEAD_TH, 'w-24')}>Status</th>
                <th className={cn(THEAD_TH, 'w-40 text-right')}>Ações</th>
              </>
            }
            rodape={<span>{filteredTermos.length} de {termos.length} termos</span>}
          >
            {filteredTermos.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    compacto
                    icone={BookOpen}
                    titulo="Nenhum verbete encontrado"
                    descricao="Ajuste os filtros de busca, letra ou status — ou cadastre um termo novo pelo formulário ao lado."
                    className="border-0"
                  />
                </td>
              </tr>
            )}
            {filteredTermos.map((t) => (
              <tr key={t.id} className="border-b border-brand-hair last:border-0 transition-colors hover:bg-brand-tint-1">
                <td className={cn(TD_CELULA, 'text-center')}>
                  <input type="checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)}
                    className="rounded border-brand-border cursor-pointer accent-brand-accent" />
                </td>
                <td className={TD_CELULA}>
                  {editingId === t.id ? (
                    <div className="space-y-1.5">
                      <Input value={editingTermo} onChange={(e) => setEditingTermo(e.target.value)}
                        className="py-1 text-sm"
                        autoFocus />
                      <Input value={editingNicho} onChange={(e) => setEditingNicho(e.target.value)}
                        className="py-1 text-xs"
                        placeholder="Nicho..." />
                    </div>
                  ) : (
                    <div>
                      <span className="font-medium text-brand-text">{t.termo}</span>
                      {t.nicho && <p className="text-[10px] text-brand-muted mt-0.5 truncate max-w-[200px]">{t.nicho}</p>}
                    </div>
                  )}
                </td>
                <td className={cn(TD_CELULA, 'text-center')}>
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-brand-accent-soft text-brand-accent text-[11px] font-bold">
                    {t.letra}
                  </span>
                </td>
                <td className={cn(TD_CELULA, 'hidden sm:table-cell')}>
                  <OrigemBadge origem={t.origem} />
                </td>
                <td className={TD_CELULA}>
                  <StatusBadge publicado={t.publicado} revisado={t.revisado} />
                </td>
                <td className={cn(TD_CELULA, 'text-right')}>
                  {editingId === t.id ? (
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => handleSaveEdit(t.id)} disabled={loadingAcao === t.id}
                        className="flex items-center gap-1 bg-brand-success-soft text-brand-success hover:brightness-95 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors">
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
                        title="Editar" className="p-1.5 text-brand-muted hover:text-brand-accent transition-colors rounded-lg hover:bg-brand-tint-2">
                        <Pencil size={13} />
                      </button>
                      {/* Gerar */}
                      {!t.publicado && (
                        <button onClick={() => handleGerarDefinicao(t.id, t.termo)} disabled={loadingAcao === t.id || isGeneratingBulk}
                          title="Gerar definição via IA"
                          className="flex items-center gap-1 bg-brand-accent-soft text-brand-accent hover:brightness-95 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors disabled:opacity-50">
                          {loadingAcao === t.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          Gerar
                        </button>
                      )}
                      {/* Ver */}
                      {t.publicado && (
                        <a href={`/glossario/${t.slug}`} target="_blank" title="Ver no site"
                          className="p-1.5 text-brand-muted hover:text-brand-accent transition-colors rounded-lg hover:bg-brand-tint-2">
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
                        title="Excluir" className="p-1.5 text-brand-muted hover:text-brand-danger transition-colors rounded-lg hover:bg-brand-danger-soft">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>
        </div>
      </div>
    </div>
  )
}
