'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, Loader2,
  Warehouse, Trash2,
  RotateCcw, Activity, Ghost, StopCircle, Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Botao, TOM_FUNDO, TOM_TEXTO } from '@/components/admin/ui/primitives'
import type { TomStatus } from '@/lib/admin/status'

// ── Diagnóstico ───────────────────────────────────────────────────────────────
interface Diag {
  total: number
  ativos: number
  inativos: number
  ativosComImagem: number
  ativosSemImagem: number
  naoVerificados: number
  emEstoque: number
  semEstoque: number
  pctComImagem: number
  pctEmEstoque: number
}

function StatBadge({ label, value, tom = 'neutro' }: { label: string; value: number | string; tom?: TomStatus }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-brand-border px-3 py-2.5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-pop',
        TOM_FUNDO[tom],
      )}
    >
      <div className={cn('text-[18px] font-black leading-none tracking-tight', TOM_TEXTO[tom])}>{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-brand-muted">{label}</div>
    </div>
  )
}

/** Barra de progresso — mesma receita nos três fluxos que precisam dela. */
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-surface-2">
      <div className="h-full rounded-full bg-brand-accent transition duration-300" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** Círculo numerado do wizard — pulsa em accent enquanto o passo roda. */
function StepBadge({ ativo, numero }: { ativo: boolean; numero: number }) {
  return (
    <div
      className={cn(
        'z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold transition-colors duration-250',
        ativo
          ? 'animate-pulse border-brand-accent bg-brand-accent text-brand-on-accent'
          : 'border-brand-border bg-brand-surface-2 text-brand-text',
      )}
    >
      {ativo ? <Loader2 size={16} className="animate-spin" /> : numero}
    </div>
  )
}

/** Aviso de sucesso/erro ao final de uma ação — legível pela cor. */
function ResultBanner({
  erro,
  tom = 'success',
  children,
  className,
}: {
  erro?: string
  tom?: 'success' | 'neutro'
  children: React.ReactNode
  className?: string
}) {
  const efetivo: TomStatus = erro ? 'danger' : tom
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border border-brand-border px-4 py-2.5 text-xs',
        TOM_FUNDO[efetivo],
        TOM_TEXTO[efetivo],
        className,
      )}
    >
      {erro ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
      <span>{erro || children}</span>
    </div>
  )
}

const TABS: { id: 'diag' | 'sync' | 'clean'; label: string; icon: typeof Activity }[] = [
  { id: 'diag', label: 'Diagnóstico', icon: Activity },
  { id: 'sync', label: 'Sincronização', icon: RefreshCw },
  { id: 'clean', label: 'Limpeza', icon: Trash2 },
]

export function OlistSyncButton() {
  const [activeTab, setActiveTab] = useState<'diag' | 'sync' | 'clean'>('diag')

  // ── Diagnóstico ─────────────────────────────────────────────────────────────
  const [diag, setDiag] = useState<Diag | null>(null)
  const [loadingDiag, setLoadingDiag] = useState(false)

  const fetchDiag = useCallback(async () => {
    setLoadingDiag(true)
    try {
      const res = await fetch('/api/admin/diagnostico')
      setDiag(await res.json())
    } finally {
      setLoadingDiag(false)
    }
  }, [])

  useEffect(() => { fetchDiag() }, [fetchDiag])

  // ── Fase 1: Produtos ─────────────────────────────────────────────────────────
  const [loadingSync, setLoadingSync] = useState(false)
  const [syncPagina, setSyncPagina] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)
  const [syncAcum, setSyncAcum] = useState({ criados: 0, atualizados: 0, erros: 0 })
  const [syncDone, setSyncDone] = useState(false)
  const [syncError, setSyncError] = useState('')

  // ── Fase 2: Imagens ──────────────────────────────────────────────────────────
  const [loadingImagens, setLoadingImagens] = useState(false)
  const [imagensRestantes, setImagensRestantes] = useState<number | null>(null)
  const [imagensNaoVerif, setImagensNaoVerif] = useState<number | null>(null)
  const [imagensAcum, setImagensAcum] = useState(0)
  const [imagensDesativ, setImagensDesativ] = useState(0)
  const [imagensError, setImagensError] = useState('')
  const [imagensDone, setImagensDone] = useState(false)
  const [imagensTotal, setImagensTotal] = useState<number | null>(null)
  const [imagensETA, setImagensETA] = useState<string>('')
  const imagensStartRef = useRef<number>(0)
  const imagensCancelRef = useRef(false)

  // ── Reset imagens ────────────────────────────────────────────────────────────
  const [loadingResetImgs, setLoadingResetImgs] = useState(false)
  const [resetImgsResult, setResetImgsResult] = useState<any>(null)

  // ── Fase 3: Estoque ──────────────────────────────────────────────────────────
  const [loadingEstoque, setLoadingEstoque] = useState(false)
  const [estoqueAcum, setEstoqueAcum] = useState(0)
  const [estoqueZerados, setEstoqueZerados] = useState<number | null>(null)
  const [estoqueTotal, setEstoqueTotal] = useState<number | null>(null)
  const [estoqueError, setEstoqueError] = useState('')
  const [estoqueDone, setEstoqueDone] = useState(false)

  // ── Limpeza de fantasmas ─────────────────────────────────────────────────────
  const [loadingFantasmas, setLoadingFantasmas] = useState(false)
  const [fantasmasStep, setFantasmasStep] = useState<'idle' | 'coletando' | 'confirmando' | 'marcando' | 'deletando' | 'done'>('idle')
  const [fantasmasProgresso, setFantasmasProgresso] = useState({ pagina: 0, totalPaginas: 0, skusColetados: 0 })
  const [fantasmasResult, setFantasmasResult] = useState<any>(null)
  const [fantasmasError, setFantasmasError] = useState('')
  /** SKUs coletados do Tiny na fase 1 — guardados aqui até o usuário confirmar a fase 2 (destrutiva). */
  const fantasmasSkusRef = useRef<string[]>([])

  // ── Delta sync ───────────────────────────────────────────────────────────────
  const [loadingDelta, setLoadingDelta] = useState(false)
  const [deltaResult, setDeltaResult] = useState<any>(null)

  async function handleSyncDelta() {
    setLoadingDelta(true); setDeltaResult(null)
    try {
      const res = await fetch('/api/olist/sync-delta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diasAtras: 2 }),
      })
      setDeltaResult(await res.json())
    } catch { setDeltaResult({ error: 'Erro de conexão' }) }
    finally { setLoadingDelta(false); fetchDiag() }
  }

  // ── Outros cleanups ──────────────────────────────────────────────────────────
  const [loadingCleanup, setLoadingCleanup] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<any>(null)

  // ── Confirmação: Remover Preço Zerado ────────────────────────────────────────
  const [loadingPrecoZeroCount, setLoadingPrecoZeroCount] = useState(false)
  const [precoZeroCount, setPrecoZeroCount] = useState<number | null>(null)
  const [precoZeroPulados, setPrecoZeroPulados] = useState(0)
  const [precoZeroConfirming, setPrecoZeroConfirming] = useState(false)

  // ── Confirmação: Corrigir Duplicados ─────────────────────────────────────────
  const [loadingDuplicadosCount, setLoadingDuplicadosCount] = useState(false)
  const [duplicadosCount, setDuplicadosCount] = useState<number | null>(null)
  const [duplicadosPulados, setDuplicadosPulados] = useState(0)
  const [duplicadosConfirming, setDuplicadosConfirming] = useState(false)

  // ── Excluir sem imagem ────────────────────────────────────────────────────────
  const [loadingSemImagem, setLoadingSemImagem] = useState(false)
  const [semImagemCount, setSemImagemCount] = useState<number | null>(null)
  const [semImagemResult, setSemImagemResult] = useState<any>(null)
  const [semImagemConfirming, setSemImagemConfirming] = useState(false)

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleSyncMetadados() {
    setLoadingSync(true); setSyncDone(false); setSyncError('')
    setSyncPagina(0); setSyncTotal(0); setSyncAcum({ criados: 0, atualizados: 0, erros: 0 })
    let pagina = 1, acum = { criados: 0, atualizados: 0, erros: 0 }
    while (true) {
      try {
        const res = await fetch('/api/olist/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pagina }),
        })
        const data = await res.json()
        if (data.error) { setSyncError(data.error); break }
        acum = { criados: acum.criados + (data.criados ?? 0), atualizados: acum.atualizados + (data.atualizados ?? 0), erros: acum.erros + (data.erros ?? 0) }
        setSyncAcum(acum); setSyncPagina(data.paginaAtual ?? pagina); setSyncTotal(data.totalPaginas ?? 1)
        if (!data.hasMore) { setSyncDone(true); break }
        pagina++
      } catch { setSyncError('Erro de conexão'); break }
    }
    setLoadingSync(false)
    fetchDiag()
  }

  async function handleBuscarImagens() {
    imagensCancelRef.current = false
    setLoadingImagens(true); setImagensDone(false); setImagensError(''); setImagensETA('')
    imagensStartRef.current = Date.now()
    let totalAcum = 0, desativAcum = 0, totalInicial: number | null = null

    while (true) {
      if (imagensCancelRef.current) break

      try {
        const res = await fetch('/api/olist/imagens', { method: 'POST' })
        const data = await res.json()
        if (data.error) { setImagensError(data.error); break }

        totalAcum += data.atualizados ?? 0
        desativAcum += data.naoEncontradosNoTiny ?? 0
        const restantes = data.naoVerificados ?? data.restantes ?? 0

        setImagensAcum(totalAcum)
        setImagensDesativ(desativAcum)
        setImagensRestantes(restantes)
        setImagensNaoVerif(restantes)

        if (totalInicial === null) {
          totalInicial = restantes + totalAcum
          setImagensTotal(totalInicial)
        }

        // Calcula ETA baseado na velocidade real
        if (totalAcum > 0 && restantes > 0) {
          const elapsed = (Date.now() - imagensStartRef.current) / 1000
          const rate = totalAcum / elapsed // produtos por segundo
          const etaSecs = rate > 0 ? Math.round(restantes / rate) : null
          if (etaSecs) {
            const min = Math.floor(etaSecs / 60)
            const sec = etaSecs % 60
            setImagensETA(min > 0 ? `~${min}min ${sec}s restantes` : `~${sec}s restantes`)
          }
        }

        if (!data.hasMore || restantes === 0) { setImagensDone(true); break }
        await new Promise(r => setTimeout(r, 800))
      } catch { setImagensError('Erro de conexão'); break }
    }
    setLoadingImagens(false)
    imagensCancelRef.current = false
    fetchDiag()
  }

  function handlePararImagens() {
    imagensCancelRef.current = true
  }

  /** Fase A (somente leitura): coleta os SKUs ativos no Tiny e pausa para confirmação antes de tocar no banco. */
  async function handleLimparFantasmas() {
    setLoadingFantasmas(true)
    setFantasmasStep('coletando')
    setFantasmasResult(null)
    setFantasmasError('')
    const todosSkus: string[] = []
    let proximaPagina: number | null = 1
    let totalPaginas = 0

    // ── Fase A: Coletar todos os SKUs do Tiny em blocos ──────────────────────
    while (proximaPagina !== null) {
      try {
        const res: Response = await fetch('/api/admin/marcar-fantasmas', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fase: 'coletar', pagina: proximaPagina }),
        })
        const data = await res.json()
        if (data.error) { setFantasmasError(data.error); setLoadingFantasmas(false); setFantasmasStep('idle'); return }

        todosSkus.push(...(data.skus ?? []))
        totalPaginas = data.totalPaginas ?? totalPaginas
        setFantasmasProgresso({ pagina: proximaPagina, totalPaginas, skusColetados: todosSkus.length })

        proximaPagina = data.done ? null : (data.proximaPagina ?? null)
        if (proximaPagina !== null) await new Promise(r => setTimeout(r, 400))
      } catch (e: any) {
        setFantasmasError('Erro de conexão: ' + e.message)
        setLoadingFantasmas(false); setFantasmasStep('idle'); return
      }
    }

    // Coleta concluída — nada foi alterado no banco ainda. Guarda os SKUs e
    // pede confirmação explícita antes de rodar a fase destrutiva (marcar/deletar).
    fantasmasSkusRef.current = todosSkus
    setLoadingFantasmas(false)
    setFantasmasStep('confirmando')
  }

  /** Fase B (destrutiva): só roda depois que o usuário confirma o que foi coletado na fase A. */
  async function handleLimparFantasmasConfirmar() {
    setLoadingFantasmas(true)
    setFantasmasStep('marcando')
    try {
      const res: Response = await fetch('/api/admin/marcar-fantasmas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 'marcar', skusTiny: fantasmasSkusRef.current }),
      })
      const data = await res.json()
      if (data.error) {
        setFantasmasError(data.error)
        setLoadingFantasmas(false)
        setFantasmasStep('idle')
        return
      }

      setFantasmasResult(data)
    } catch (e: any) {
      setFantasmasError('Erro na limpeza: ' + e.message)
    }

    setLoadingFantasmas(false)
    setFantasmasStep('done')
    fetchDiag()
  }

  /** Descarta os SKUs coletados sem tocar no banco. */
  function handleLimparFantasmasCancelar() {
    fantasmasSkusRef.current = []
    setFantasmasStep('idle')
  }

  async function handleResetImagens() {
    setLoadingResetImgs(true); setResetImgsResult(null)
    try {
      const res = await fetch('/api/admin/reset-imgs', { method: 'POST' })
      setResetImgsResult(await res.json())
    } catch { setResetImgsResult({ error: 'Erro de conexão' }) }
    finally { setLoadingResetImgs(false) }
  }

  async function handleSyncEstoque() {
    setLoadingEstoque(true); setEstoqueDone(false); setEstoqueError(''); let acum = 0
    while (true) {
      try {
        const res = await fetch('/api/olist/estoque', { method: 'POST' })
        const data = await res.json()
        if (data.error) { setEstoqueError(data.error); break }
        acum += data.atualizados ?? 0; setEstoqueAcum(acum)
        setEstoqueZerados(data.pendentes ?? 0); setEstoqueTotal(data.total ?? null)
        if (!data.hasMore) { setEstoqueDone(true); break }
        await new Promise(r => setTimeout(r, 1500))
      } catch { setEstoqueError('Erro de conexão'); break }
    }
    setLoadingEstoque(false)
    fetchDiag()
  }

  async function handleCleanup(tipo: string) {
    setLoadingCleanup(true); setCleanupResult(null)
    try {
      const res = await fetch('/api/admin/cleanup-produtos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
      setCleanupResult(await res.json())
    } catch { setCleanupResult({ error: 'Erro de conexão' }) }
    finally { setLoadingCleanup(false); fetchDiag() }
  }

  // ── Preço Zerado: conta antes, deleta só depois de confirmado ───────────────
  async function handlePrecoZeroCount() {
    setLoadingPrecoZeroCount(true); setPrecoZeroCount(null); setPrecoZeroConfirming(false); setCleanupResult(null)
    try {
      const res = await fetch('/api/admin/cleanup-produtos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'preco_zero_count' }),
      })
      const data = await res.json()
      // Sem checar o status, um 403 de sessão expirada viraria “0 serão
      // excluídos” com o botão de confirmar liberado.
      if (!res.ok || data.error) {
        setCleanupResult({ error: data.error || 'Não consegui contar os produtos.' })
        return
      }
      setPrecoZeroCount(data.count ?? 0)
      setPrecoZeroPulados(data.pulados ?? 0)
      setPrecoZeroConfirming(true)
    } catch { setCleanupResult({ error: 'Erro de conexão' }) }
    finally { setLoadingPrecoZeroCount(false) }
  }

  async function handlePrecoZeroConfirm() {
    setPrecoZeroConfirming(false)
    await handleCleanup('preco_zero')
  }

  // ── Duplicados: conta antes, corrige só depois de confirmado ────────────────
  async function handleDuplicadosCount() {
    setLoadingDuplicadosCount(true); setDuplicadosCount(null); setDuplicadosConfirming(false); setCleanupResult(null)
    try {
      const res = await fetch('/api/admin/cleanup-produtos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'duplicados_count' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setCleanupResult({ error: data.error || 'Não consegui contar os duplicados.' })
        return
      }
      setDuplicadosCount(data.count ?? 0)
      setDuplicadosPulados(data.pulados ?? 0)
      setDuplicadosConfirming(true)
    } catch { setCleanupResult({ error: 'Erro de conexão' }) }
    finally { setLoadingDuplicadosCount(false) }
  }

  async function handleDuplicadosConfirm() {
    setDuplicadosConfirming(false)
    await handleCleanup('duplicados')
  }

  async function handleSemImagemCount() {
    setLoadingSemImagem(true); setSemImagemCount(null); setSemImagemResult(null); setSemImagemConfirming(false)
    try {
      const res = await fetch('/api/admin/cleanup-produtos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'sem_imagem_count' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setSemImagemResult({ error: data.error || 'Não consegui contar os produtos.' })
        return
      }
      setSemImagemCount(data.count ?? 0)
      setSemImagemConfirming(true)
    } catch { setSemImagemResult({ error: 'Erro de conexão' }) }
    finally { setLoadingSemImagem(false) }
  }

  async function handleSemImagemConfirm() {
    setLoadingSemImagem(true); setSemImagemConfirming(false)
    try {
      const res = await fetch('/api/admin/cleanup-produtos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'sem_imagem' }),
      })
      setSemImagemResult(await res.json())
    } catch { setSemImagemResult({ error: 'Erro de conexão' }) }
    finally { setLoadingSemImagem(false); fetchDiag() }
  }

  const pctSync = syncTotal > 0 ? Math.round((syncPagina / syncTotal) * 100) : 0
  const pctImagens = imagensTotal && imagensTotal > 0
    ? Math.min(100, Math.round((imagensAcum / imagensTotal) * 100)) : 0
  const pctFantasmas = fantasmasProgresso.totalPaginas > 0
    ? Math.round((fantasmasProgresso.pagina / fantasmasProgresso.totalPaginas) * 100) : 0

  const isAnyRunning = loadingSync || loadingImagens || loadingEstoque || loadingFantasmas || loadingCleanup || loadingSemImagem || loadingDelta || loadingResetImgs || loadingPrecoZeroCount || loadingDuplicadosCount

  return (
    <div className="relative space-y-6 overflow-hidden rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-pop transition duration-300 md:p-8">

      {/* Glow decorativo de fundo */}
      <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-brand-accent-soft blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-brand-tint-3 blur-[100px]" />

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 border-b border-brand-hair pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-barlow text-2xl font-black uppercase tracking-tight text-brand-text">
            <RefreshCw size={20} className={cn('text-brand-accent', isAnyRunning && 'animate-spin')} />
            Sincronizador OLIST / Tiny
          </h3>
          <p className="mt-0.5 text-xs text-brand-muted">
            Gerencie catálogo, imagens e estoque físico do ERP integrado
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-1 rounded-2xl border border-brand-border bg-brand-surface-2 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition duration-200',
                activeTab === tab.id
                  ? 'bg-brand-accent text-brand-on-accent shadow-cta'
                  : 'text-brand-muted hover:text-brand-text',
              )}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ALERTA DE EXECUÇÃO EM ANDAMENTO ── */}
      {isAnyRunning && (
        <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-brand-accent bg-brand-accent-soft px-4 py-3">
          <Loader2 size={14} className="shrink-0 animate-spin text-brand-accent" />
          <span className="text-xs font-semibold text-brand-text">
            Uma tarefa está em execução em segundo plano. Outras ações estão bloqueadas por segurança.
          </span>
        </div>
      )}

      {/* ── ABA 1: DIAGNÓSTICO E STATUS ── */}
      {activeTab === 'diag' && (
        <div className="animate-fade-in-up space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-wider text-brand-muted">
              Estado atual do catálogo local
            </p>
            <Botao variante="secundario" tamanho="sm" onClick={fetchDiag} disabled={loadingDiag || isAnyRunning}>
              {loadingDiag ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
              Atualizar Diagnóstico
            </Botao>
          </div>

          {diag ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Card principal */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:col-span-2">
                <StatBadge label="Total no banco" value={diag.total} tom="neutro" />
                <StatBadge label="Storefront ativo" value={diag.ativos} tom="success" />
                <StatBadge label="Fantasmas inativos" value={diag.inativos} tom={diag.inativos > 0 ? 'danger' : 'neutro'} />
                <StatBadge label="Com fotos" value={diag.ativosComImagem} tom="success" />
                <StatBadge label="Sem fotos (inativos)" value={diag.ativosSemImagem} tom={diag.ativosSemImagem > 0 ? 'warning' : 'neutro'} />
                <StatBadge label="Não verificados" value={diag.naoVerificados} tom={diag.naoVerificados > 0 ? 'info' : 'neutro'} />
              </div>

              {/* Saúde geral card */}
              <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-brand-border bg-brand-surface-2 p-5">
                <div>
                  <h4 className="mb-2 text-xs font-black uppercase tracking-wider text-brand-muted">Saúde do Catálogo</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="font-barlow text-3xl font-black tracking-tight text-brand-text">{diag.pctComImagem}%</span>
                    <span className="text-xs text-brand-muted">de cobertura de fotos</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Cobertura barra */}
                  <div className="h-2 w-full overflow-hidden rounded-full border border-brand-hair bg-brand-bg">
                    <div
                      className={cn(
                        'h-full rounded-full transition duration-1000',
                        diag.pctComImagem >= 90 ? 'bg-brand-success' : diag.pctComImagem >= 70 ? 'bg-brand-warning' : 'bg-brand-danger',
                      )}
                      style={{ width: `${diag.pctComImagem}%` }}
                    />
                  </div>

                  {/* Detalhes de estoque */}
                  <div className="flex items-center justify-between border-t border-brand-hair pt-2 text-xs">
                    <span className="text-brand-muted">Em estoque:</span>
                    <span className="font-bold text-brand-success">{diag.emEstoque} ({diag.pctEmEstoque}%)</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-muted">Fora de estoque (inativos):</span>
                    <span className="font-bold text-brand-text">{diag.semEstoque}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-border py-10">
              <Loader2 size={24} className="mb-2 animate-spin text-brand-accent" />
              <p className="text-xs text-brand-muted">Carregando diagnóstico do catálogo...</p>
            </div>
          )}

          <div className="space-y-2 rounded-2xl border border-brand-border bg-brand-surface-2 p-4">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
              <CheckCircle2 size={13} className="text-brand-success" />
              Entendendo as Regras de Ativação do E-commerce
            </h4>
            <p className="text-xs leading-relaxed text-brand-muted">
              O Forza Motos protege a experiência do cliente através de regras rígidas de ativação. Um produto só fica visível para compra se estiver <strong>ativo no Tiny ERP</strong>, possuir <strong>pelo menos 1 imagem anexa</strong> e tiver <strong>estoque físico ativo (&gt; 0)</strong>. Caso contrário, ele é automaticamente mantido como inativo.
            </p>
          </div>
        </div>
      )}

      {/* ── ABA 2: ASSISTENTE DE SINCRONIZAÇÃO (WIZARD) ── */}
      {activeTab === 'sync' && (
        <div className="animate-fade-in-up space-y-8">
          <p className="text-xs font-black uppercase tracking-wider text-brand-muted">
            Fluxo guiado de importação
          </p>

          <div className="relative space-y-6 before:absolute before:bottom-4 before:left-6 before:top-4 before:w-0.5 before:bg-brand-hair">

            {/* PASSO 1: Catálogo e Metadados */}
            <div className="relative flex gap-4">
              <StepBadge ativo={loadingSync} numero={1} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="flex items-center gap-1.5 text-sm font-bold text-brand-text">
                      Passo 1 — Importar Catálogo Completo
                    </h4>
                    <p className="text-xs text-brand-muted">
                      Importa códigos, nomes, marcas, categorias e situação ativa dos produtos
                    </p>
                  </div>
                  <Botao onClick={handleSyncMetadados} disabled={isAnyRunning} tamanho="sm" className="self-start sm:self-auto">
                    <RefreshCw size={11} />
                    {loadingSync ? `Pag. ${syncPagina}/${syncTotal}` : 'Iniciar Importação'}
                  </Botao>
                </div>

                {loadingSync && syncTotal > 0 && (
                  <div className="max-w-md space-y-1.5 rounded-xl border border-brand-border bg-brand-surface-2 p-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                      <span>Importando dados do Tiny ERP...</span>
                      <span>{pctSync}% ({syncPagina}/{syncTotal})</span>
                    </div>
                    <ProgressBar pct={pctSync} />
                    <div className="flex gap-4 text-[10px] text-brand-muted">
                      <span>Criados: <strong className="font-bold text-brand-success">{syncAcum.criados}</strong></span>
                      <span>Atualizados: <strong className="font-bold text-brand-info">{syncAcum.atualizados}</strong></span>
                      <span>Falhas: <strong className="font-bold text-brand-danger">{syncAcum.erros}</strong></span>
                    </div>
                  </div>
                )}

                {!loadingSync && (syncDone || syncError) && (
                  <ResultBanner erro={syncError} className="max-w-md">
                    {`Sucesso: ${syncAcum.criados} novos criados e ${syncAcum.atualizados} atualizados no banco local.`}
                  </ResultBanner>
                )}

                {/* Sincronização Delta */}
                <div className="flex max-w-xl flex-col justify-between gap-2 border-t border-brand-hair pt-2 sm:flex-row sm:items-center">
                  <div>
                    <h5 className="flex items-center gap-1 text-[11px] font-bold text-brand-text">
                      <Activity size={10} className="text-brand-success" />
                      Sincronização Rápida (Estoque & Preço Delta)
                    </h5>
                    <p className="text-[10px] text-brand-muted">
                      Verifica apenas produtos modificados nas últimas 48h
                    </p>
                  </div>
                  <Botao variante="secundario" tamanho="sm" onClick={handleSyncDelta} disabled={isAnyRunning} className="self-start sm:self-auto">
                    {loadingDelta ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} className="text-brand-success" />}
                    Sync Rápido
                  </Botao>
                </div>
                {!loadingDelta && deltaResult && (
                  <ResultBanner erro={deltaResult.error} className="max-w-md">
                    {`Sync Delta concluído: ${deltaResult.estoque?.atualizados ?? 0} estoques e ${deltaResult.produtos?.atualizados ?? 0} produtos sincronizados.`}
                  </ResultBanner>
                )}
              </div>
            </div>

            {/* PASSO 2: Imagens e Fotos anexas */}
            <div className="relative flex gap-4">
              <StepBadge ativo={loadingImagens} numero={2} />
              <div className="flex-1 space-y-3 pt-1">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="text-sm font-bold text-brand-text">
                      Passo 2 — Importar Imagens & Anexos
                    </h4>
                    <p className="text-xs text-brand-muted">
                      Varre o Tiny ERP extraindo os anexos de foto e atualiza a visibilidade
                    </p>
                  </div>
                  {!loadingImagens ? (
                    <Botao onClick={handleBuscarImagens} disabled={isAnyRunning} tamanho="sm" className="self-start sm:self-auto">
                      <Play size={11} />
                      Importar Imagens
                    </Botao>
                  ) : (
                    <Botao variante="secundario" tamanho="sm" onClick={handlePararImagens} className="self-start sm:self-auto">
                      <StopCircle size={11} className="animate-pulse text-brand-accent" />
                      Parar Processo
                    </Botao>
                  )}
                </div>

                {loadingImagens && (
                  <div className="animate-fade-in-up max-w-md space-y-1.5 rounded-xl border border-brand-border bg-brand-surface-2 p-3.5">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                      <span className="flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin text-brand-accent" />
                        Sincronizando anexos do ERP...
                      </span>
                      <span>{pctImagens}% ({imagensAcum}/{imagensTotal ?? '?'})</span>
                    </div>
                    <ProgressBar pct={pctImagens} />
                    <div className="flex items-center justify-between text-[10px] text-brand-muted">
                      <span>Restantes no banco: <strong>{imagensRestantes ?? '?'}</strong></span>
                      {imagensETA && <span className="font-bold text-brand-accent">{imagensETA}</span>}
                    </div>
                  </div>
                )}

                {!loadingImagens && (imagensDone || imagensError) && (
                  <ResultBanner erro={imagensError} className="max-w-md">
                    {`Concluído: ${imagensAcum} produtos com fotos anexadas importados com sucesso.`}
                  </ResultBanner>
                )}

                {/* Reset de verificação */}
                <div className="flex max-w-xl flex-col justify-between gap-2 border-t border-brand-hair pt-2 sm:flex-row sm:items-center">
                  <div>
                    <h5 className="text-[11px] font-bold text-brand-text">Re-checar produtos marcados &quot;Sem Foto&quot;</h5>
                    <p className="text-[10px] text-brand-muted">Reseta a fila de verificação para tentar buscar fotos novamente</p>
                  </div>
                  <Botao
                    variante="secundario"
                    tamanho="sm"
                    onClick={handleResetImagens}
                    disabled={isAnyRunning || loadingImagens}
                    className="self-start sm:self-auto"
                  >
                    {loadingResetImgs ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Resetar Fila
                  </Botao>
                </div>
                {!loadingResetImgs && resetImgsResult && (
                  <div className="max-w-md rounded-xl border border-brand-border bg-brand-surface-2 px-4 py-2 text-xs text-brand-muted">
                    {resetImgsResult.error || resetImgsResult.info}
                  </div>
                )}
              </div>
            </div>

            {/* PASSO 3: Estoque Físico */}
            <div className="relative flex gap-4">
              <StepBadge ativo={loadingEstoque} numero={3} />
              <div className="flex-1 space-y-2 pt-1">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h4 className="text-sm font-bold text-brand-text">
                      Passo 3 — Sincronizar Estoque Físico Real
                    </h4>
                    <p className="text-xs text-brand-muted">
                      Consulta e salva o saldo de estoque físico detalhado por depósito
                    </p>
                  </div>
                  <Botao variante="secundario" tamanho="sm" onClick={handleSyncEstoque} disabled={isAnyRunning} className="self-start sm:self-auto">
                    {loadingEstoque ? <Loader2 size={11} className="animate-spin" /> : <Warehouse size={11} />}
                    Sincronizar Estoque
                  </Botao>
                </div>

                {loadingEstoque && (
                  <div className="max-w-md rounded-xl border border-brand-border bg-brand-surface-2 px-4 py-2 text-xs text-brand-muted">
                    Consultando estoque físico... {estoqueAcum} produtos processados de {estoqueTotal ?? '?'}.
                  </div>
                )}

                {!loadingEstoque && (estoqueDone || estoqueError) && (
                  <ResultBanner erro={estoqueError} className="max-w-md">
                    {`Estoque verificado com sucesso para ${estoqueAcum} produtos.`}
                  </ResultBanner>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── ABA 3: LIMPEZA E AJUSTES AVANÇADOS ── */}
      {activeTab === 'clean' && (
        <div className="animate-fade-in-up space-y-6">
          <p className="text-xs font-black uppercase tracking-wider text-brand-muted">
            Ferramentas avançadas de limpeza
          </p>

          {/* Passo 0: Limpar Fantasmas */}
          <div className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface-2 p-5">
            <div className="flex items-center gap-2.5 text-brand-text">
              <Ghost size={18} className="animate-pulse text-brand-accent" />
              <div>
                <h4 className="text-sm font-bold text-brand-text">Passo 0 — Limpar Fantasmas Automático</h4>
                <p className="text-xs text-brand-muted">
                  Compara a base local com os produtos cadastrados no Tiny e exclui permanentemente o que foi apagado no ERP. Preserva históricos de pedidos.
                </p>
              </div>
            </div>

            {fantasmasStep !== 'confirmando' ? (
              <Botao
                variante="perigo"
                onClick={handleLimparFantasmas}
                disabled={isAnyRunning}
                className="w-full"
              >
                {loadingFantasmas ? <Loader2 size={12} className="animate-spin" /> : <Ghost size={12} />}
                {loadingFantasmas
                  ? fantasmasStep === 'coletando'
                    ? `Coletando SKUs do Tiny… ${fantasmasProgresso.pagina}/${fantasmasProgresso.totalPaginas} páginas (${fantasmasProgresso.skusColetados} SKUs)`
                    : fantasmasStep === 'marcando'
                    ? 'Comparando banco local…'
                    : 'Limpando e deletando fantasmas…'
                  : 'Iniciar Limpeza de Fantasmas'
                }
              </Botao>
            ) : (
              <div className="space-y-3 rounded-xl border border-brand-warning bg-brand-warning-soft p-4">
                <p className="text-center text-xs font-bold text-brand-warning">
                  ⚠️ {fantasmasProgresso.skusColetados} SKUs ativos foram encontrados no Tiny ERP. Todo produto local
                  vinculado ao Tiny que não estiver nessa lista será excluído para sempre do banco (ou desativado
                  permanentemente, se tiver pedidos). Essa operação é irreversível.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Botao variante="secundario" onClick={handleLimparFantasmasCancelar}>
                    Cancelar
                  </Botao>
                  <Botao variante="perigo" onClick={handleLimparFantasmasConfirmar} disabled={loadingFantasmas}>
                    {loadingFantasmas ? <Loader2 size={12} className="animate-spin" /> : <Ghost size={12} />}
                    Confirmar Limpeza
                  </Botao>
                </div>
              </div>
            )}

            {loadingFantasmas && fantasmasStep === 'coletando' && fantasmasProgresso.totalPaginas > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                  <span>Varrendo catálogo Tiny ERP...</span>
                  <span>{pctFantasmas}%</span>
                </div>
                <ProgressBar pct={pctFantasmas} />
              </div>
            )}

            {!loadingFantasmas && (fantasmasResult || fantasmasError) && (
              <ResultBanner erro={fantasmasError}>
                {fantasmasResult?.msg || `Limpeza concluída com sucesso: ${fantasmasResult?.deletados ?? 0} fantasmas excluídos definitivamente do banco e ${fantasmasResult?.marcados ?? 0} marcados como inativos por possuírem pedidos.`}
              </ResultBanner>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {/* Remover R$0,00 */}
            <div className="flex flex-col justify-between space-y-3 rounded-2xl border border-brand-border bg-brand-surface-2 p-4">
              <div>
                <h5 className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
                  <Trash2 size={13} className="text-brand-warning" />
                  Preço Zerado (R$ 0,00)
                </h5>
                <p className="text-[11px] text-brand-muted">
                  Exclui produtos que foram importados com preço zerado.
                </p>
              </div>

              {!precoZeroConfirming ? (
                <Botao variante="perigo" tamanho="sm" onClick={handlePrecoZeroCount} disabled={isAnyRunning} className="w-full">
                  {loadingPrecoZeroCount ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Remover Preço Zerado
                </Botao>
              ) : (
                <div className="space-y-2 rounded-xl border border-brand-warning bg-brand-warning-soft p-3">
                  <p className="text-center text-[11px] font-bold text-brand-warning">
                    ⚠️ {precoZeroCount} produtos com preço R$ 0,00 serão excluídos para sempre. Irreversível.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Botao
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => { setPrecoZeroConfirming(false); setPrecoZeroCount(null) }}
                    >
                      Cancelar
                    </Botao>
                    <Botao variante="perigo" tamanho="sm" onClick={handlePrecoZeroConfirm} disabled={loadingCleanup}>
                      {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Confirmar
                    </Botao>
                  </div>
                </div>
              )}
            </div>

            {/* Duplicados */}
            <div className="flex flex-col justify-between space-y-3 rounded-2xl border border-brand-border bg-brand-surface-2 p-4">
              <div>
                <h5 className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
                  <Trash2 size={13} className="text-brand-muted" />
                  Produtos Duplicados
                </h5>
                <p className="text-[11px] text-brand-muted">
                  Identifica produtos com o mesmo tinyId e mantém apenas a versão mais recente.
                </p>
              </div>

              {!duplicadosConfirming ? (
                <Botao variante="perigo" tamanho="sm" onClick={handleDuplicadosCount} disabled={isAnyRunning} className="w-full">
                  {loadingDuplicadosCount ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  Corrigir Duplicados
                </Botao>
              ) : (
                <div className="space-y-2 rounded-xl border border-brand-warning bg-brand-warning-soft p-3">
                  <p className="text-center text-[11px] font-bold text-brand-warning">
                    ⚠️ {duplicadosCount} produtos duplicados serão excluídos para sempre (mantendo o mais recente de cada). Irreversível.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Botao
                      variante="secundario"
                      tamanho="sm"
                      onClick={() => { setDuplicadosConfirming(false); setDuplicadosCount(null) }}
                    >
                      Cancelar
                    </Botao>
                    <Botao variante="perigo" tamanho="sm" onClick={handleDuplicadosConfirm} disabled={loadingCleanup}>
                      {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Confirmar
                    </Botao>
                  </div>
                </div>
              )}
            </div>

          </div>

          {!loadingCleanup && cleanupResult && (
            <ResultBanner erro={cleanupResult.error} tom="neutro">
              {cleanupResult.msg || `${cleanupResult.removidos} produtos removidos com sucesso.`}
            </ResultBanner>
          )}

          {/* ── Excluir sem foto (Ação perigosa) ── */}
          <div className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface-2 p-5">
            <h5 className="flex items-center gap-1.5 text-xs font-bold text-brand-text">
              <AlertCircle size={14} className="text-brand-warning" />
              Excluir produtos sem nenhuma foto
            </h5>
            <p className="text-xs text-brand-muted">
              Apaga permanentemente da base local os produtos que já foram varridos no Passo 2 e confirmados como &quot;sem imagem&quot; no Tiny ERP.
            </p>

            {!semImagemConfirming ? (
              <Botao variante="perigo" onClick={handleSemImagemCount} disabled={isAnyRunning} className="w-full">
                <Trash2 size={12} />
                Excluir produtos sem foto
              </Botao>
            ) : (
              <div className="space-y-3 rounded-xl border border-brand-warning bg-brand-warning-soft p-4">
                <p className="text-center text-xs font-bold text-brand-warning">
                  ⚠️ {semImagemCount} produtos sem foto no banco local serão excluídos para sempre! Essa operação é irreversível.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Botao
                    variante="secundario"
                    onClick={() => { setSemImagemConfirming(false); setSemImagemCount(null) }}
                  >
                    Cancelar
                  </Botao>
                  <Botao variante="perigo" onClick={handleSemImagemConfirm} disabled={loadingSemImagem}>
                    {loadingSemImagem ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Confirmar Exclusão
                  </Botao>
                </div>
              </div>
            )}

            {!loadingSemImagem && semImagemResult && (
              <ResultBanner erro={semImagemResult.error}>
                {semImagemResult.msg || `${semImagemResult.removidos} produtos sem fotos excluídos com sucesso.`}
              </ResultBanner>
            )}
          </div>
        </div>
      )}

      {/* Footer / Nota */}
      <div className="flex flex-col items-center justify-between gap-2 border-t border-brand-hair pt-4 text-[10px] font-bold uppercase tracking-wider text-brand-muted sm:flex-row">
        <span>Canal integrado: Olist ERP (Tiny)</span>
        <span>Webhook e WebHooks delta integrados de forma segura</span>
      </div>

    </div>
  )
}
