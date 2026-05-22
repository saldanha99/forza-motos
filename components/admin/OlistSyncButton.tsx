'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, Loader2,
  Package, Image as ImageIcon, Warehouse, Trash2,
  RotateCcw, ArrowUpRight, Activity, Ghost, StopCircle, Play,
} from 'lucide-react'

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

function StatBadge({ label, value, color = 'zinc' }: { label: string; value: number | string; color?: string }) {
  const colors: Record<string, string> = {
    zinc:   'bg-brand-surface-2 border-brand-border/30 text-brand-muted hover:border-brand-accent/30',
    green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:border-emerald-500/30',
    red:    'bg-red-500/10 border-red-500/20 text-red-400 hover:border-red-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400 hover:border-yellow-500/30',
    blue:   'bg-brand-accent/10 border-brand-accent/20 text-brand-text hover:border-brand-accent/40',
  }
  return (
    <div className={`rounded-xl px-3 py-2.5 border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${colors[color] ?? colors.zinc}`}>
      <div className="text-[18px] font-black leading-none tracking-tight">{value}</div>
      <div className="text-[10px] mt-1 font-semibold uppercase tracking-wider opacity-80">{label}</div>
    </div>
  )
}

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
  const [fantasmasStep, setFantasmasStep] = useState<'idle' | 'coletando' | 'marcando' | 'deletando' | 'done'>('idle')
  const [fantasmasProgresso, setFantasmasProgresso] = useState({ pagina: 0, totalPaginas: 0, skusColetados: 0 })
  const [fantasmasResult, setFantasmasResult] = useState<any>(null)
  const [fantasmasError, setFantasmasError] = useState('')

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

  // ── Excluir sem imagem ────────────────────────────────────────────────────────
  const [loadingSemImagem, setLoadingSemImagem] = useState(false)
  const [semImagemCount, setSemImagemCount] = useState<number | null>(null)
  const [semImagemResult, setSemImagemResult] = useState<any>(null)
  const [semImagemConfirming, setSemImagemConfirming] = useState(false)

  // ── Reconciliação ────────────────────────────────────────────────────────────
  const [loadingRecon, setLoadingRecon] = useState(false)
  const [reconResult, setReconResult] = useState<any>(null)

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

    // ── Fase B: Marcar e limpar fantasmas no banco ───────────────────────────
    setFantasmasStep('marcando')
    try {
      const res: Response = await fetch('/api/admin/marcar-fantasmas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 'marcar', skusTiny: todosSkus }),
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
        await new Promise(r => setTimeout(r, 6000))
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

  async function handleSemImagemCount() {
    setLoadingSemImagem(true); setSemImagemCount(null); setSemImagemResult(null); setSemImagemConfirming(false)
    try {
      const res = await fetch('/api/admin/cleanup-produtos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'sem_imagem_count' }),
      })
      const data = await res.json()
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

  async function handleReconciliar() {
    setLoadingRecon(true); setReconResult(null)
    try {
      const res = await fetch('/api/olist/reconciliar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutosAtras: 90 }),
      })
      setReconResult(await res.json())
    } catch { setReconResult({ error: 'Erro de conexão' }) }
    finally { setLoadingRecon(false); fetchDiag() }
  }

  const pctSync = syncTotal > 0 ? Math.round((syncPagina / syncTotal) * 100) : 0
  const pctImagens = imagensTotal && imagensTotal > 0
    ? Math.min(100, Math.round((imagensAcum / imagensTotal) * 100)) : 0
  const pctFantasmas = fantasmasProgresso.totalPaginas > 0
    ? Math.round((fantasmasProgresso.pagina / fantasmasProgresso.totalPaginas) * 100) : 0

  const isAnyRunning = loadingSync || loadingImagens || loadingEstoque || loadingFantasmas || loadingCleanup || loadingSemImagem || loadingDelta || loadingRecon || loadingResetImgs

  return (
    <div className="admin-glass !bg-black/40 border border-brand-border/40 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl transition-all duration-300 relative overflow-hidden">
      
      {/* Glow decorativo de fundo */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-brand-accent/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border/20">
        <div>
          <h3 className="font-barlow font-black text-2xl text-brand-text tracking-tight uppercase flex items-center gap-2">
            <RefreshCw size={20} className={`text-brand-accent ${isAnyRunning ? 'animate-spin' : ''}`} />
            Sincronizador OLIST / Tiny
          </h3>
          <p className="text-xs text-brand-muted mt-0.5">
            Gerencie catálogo, imagens e estoque físico do ERP integrado
          </p>
        </div>
        
        {/* Tab Switcher */}
        <div className="flex bg-brand-surface-2/80 p-1 rounded-2xl gap-1 border border-brand-border/20">
          <button
            onClick={() => setActiveTab('diag')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${activeTab === 'diag' ? 'bg-brand-accent text-white shadow-md' : 'text-brand-muted hover:text-brand-text'}`}
          >
            <Activity size={13} />
            Diagnóstico
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${activeTab === 'sync' ? 'bg-brand-accent text-white shadow-md' : 'text-brand-muted hover:text-brand-text'}`}
          >
            <RefreshCw size={13} />
            Sincronização
          </button>
          <button
            onClick={() => setActiveTab('clean')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${activeTab === 'clean' ? 'bg-brand-accent text-white shadow-md' : 'text-brand-muted hover:text-brand-text'}`}
          >
            <Trash2 size={13} />
            Limpeza
          </button>
        </div>
      </div>

      {/* ── ALERTA DE EXECUÇÃO EM ANDAMENTO ── */}
      {isAnyRunning && (
        <div className="flex items-center gap-3 px-4 py-3 bg-brand-accent/10 border border-brand-accent/30 rounded-2xl animate-pulse">
          <Loader2 size={14} className="animate-spin text-brand-accent shrink-0" />
          <span className="text-xs font-semibold text-brand-text">
            Uma tarefa está em execução em segundo plano. Outras ações estão bloqueadas por segurança.
          </span>
        </div>
      )}

      {/* ── ABA 1: DIAGNÓSTICO E STATUS ── */}
      {activeTab === 'diag' && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black text-brand-muted uppercase tracking-wider">
              Estado atual do catálogo local
            </p>
            <button
              onClick={fetchDiag}
              disabled={loadingDiag || isAnyRunning}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-surface-2 hover:bg-brand-accent/20 border border-brand-border/30 text-brand-text text-xs font-bold rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              {loadingDiag ? <Loader2 size={12} className="animate-spin" /> : <Activity size={12} />}
              Atualizar Diagnóstico
            </button>
          </div>

          {diag ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Card principal */}
              <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatBadge label="Total no banco" value={diag.total} color="zinc" />
                <StatBadge label="Storefront ativo" value={diag.ativos} color="green" />
                <StatBadge label="Fantasmas inativos" value={diag.inativos} color={diag.inativos > 0 ? 'red' : 'zinc'} />
                <StatBadge label="Com fotos" value={diag.ativosComImagem} color="green" />
                <StatBadge label="Sem fotos (inativos)" value={diag.ativosSemImagem} color={diag.ativosSemImagem > 0 ? 'yellow' : 'zinc'} />
                <StatBadge label="Não verificados" value={diag.naoVerificados} color={diag.naoVerificados > 0 ? 'blue' : 'zinc'} />
              </div>

              {/* Saúde geral card */}
              <div className="bg-brand-surface-2/65 border border-brand-border/20 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="text-xs font-black text-brand-muted uppercase tracking-wider mb-2">Saúde do Catálogo</h4>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-brand-text tracking-tight">{diag.pctComImagem}%</span>
                    <span className="text-xs text-brand-muted">de cobertura de fotos</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Cobertura barra */}
                  <div className="w-full bg-brand-bg rounded-full h-2 overflow-hidden border border-brand-border/10">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${diag.pctComImagem}%`,
                        backgroundColor: diag.pctComImagem >= 90 ? '#10b981' : diag.pctComImagem >= 70 ? '#f59e0b' : '#d42b2b'
                      }}
                    />
                  </div>
                  
                  {/* Detalhes de estoque */}
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-brand-border/10">
                    <span className="text-brand-muted">Em estoque:</span>
                    <span className="font-bold text-emerald-400">{diag.emEstoque} ({diag.pctEmEstoque}%)</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-brand-muted">Fora de estoque (inativos):</span>
                    <span className="font-bold text-brand-text">{diag.semEstoque}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-brand-surface-2/30 rounded-2xl border border-dashed border-brand-border/30">
              <Loader2 size={24} className="animate-spin text-brand-accent mb-2" />
              <p className="text-xs text-brand-muted">Carregando diagnóstico do catálogo...</p>
            </div>
          )}

          <div className="p-4 bg-brand-surface-2/40 border border-brand-border/20 rounded-2xl space-y-2">
            <h4 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" />
              Entendendo as Regras de Ativação do E-commerce
            </h4>
            <p className="text-xs text-brand-muted leading-relaxed">
              O Forza Motos protege a experiência do cliente através de regras rígidas de ativação. Um produto só fica visível para compra se estiver <strong>ativo no Tiny ERP</strong>, possuir <strong>pelo menos 1 imagem anexa</strong> e tiver <strong>estoque físico ativo (&gt; 0)</strong>. Caso contrário, ele é automaticamente mantido como inativo.
            </p>
          </div>
        </div>
      )}

      {/* ── ABA 2: ASSISTENTE DE SINCRONIZAÇÃO (WIZARD) ── */}
      {activeTab === 'sync' && (
        <div className="space-y-8 animate-fade-in-up">
          <p className="text-xs font-black text-brand-muted uppercase tracking-wider">
            Fluxo guiado de importação
          </p>

          <div className="space-y-6 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-brand-border/20">
            
            {/* PASSO 1: Catálogo e Metadados */}
            <div className="flex gap-4 relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-bold text-sm shrink-0 z-10 transition-colors duration-250 ${loadingSync ? 'bg-brand-accent border-brand-accent text-white animate-pulse' : 'bg-brand-surface-2 border-brand-border/40 text-brand-text'}`}>
                {loadingSync ? <Loader2 size={16} className="animate-spin" /> : '1'}
              </div>
              <div className="space-y-2 flex-1 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-brand-text flex items-center gap-1.5">
                      Passo 1 — Importar Catálogo Completo
                    </h4>
                    <p className="text-xs text-brand-muted">
                      Importa códigos, nomes, marcas, categorias e situação ativa dos produtos
                    </p>
                  </div>
                  <button
                    onClick={handleSyncMetadados}
                    disabled={isAnyRunning}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-accent/20"
                  >
                    <RefreshCw size={11} />
                    {loadingSync ? `Pag. ${syncPagina}/${syncTotal}` : 'Iniciar Importação'}
                  </button>
                </div>

                {loadingSync && syncTotal > 0 && (
                  <div className="space-y-1.5 max-w-md bg-brand-bg/50 p-3 rounded-xl border border-brand-border/20">
                    <div className="flex justify-between text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      <span>Importando dados do Tiny ERP...</span>
                      <span>{pctSync}% ({syncPagina}/{syncTotal})</span>
                    </div>
                    <div className="w-full bg-brand-surface-2 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-brand-accent h-full rounded-full transition-all duration-300" style={{ width: `${pctSync}%` }} />
                    </div>
                    <div className="flex gap-4 text-[10px] text-brand-muted">
                      <span>Criados: <strong className="text-emerald-400 font-bold">{syncAcum.criados}</strong></span>
                      <span>Atualizados: <strong className="text-blue-400 font-bold">{syncAcum.atualizados}</strong></span>
                      <span>Falhas: <strong className="text-red-400 font-bold">{syncAcum.erros}</strong></span>
                    </div>
                  </div>
                )}

                {!loadingSync && (syncDone || syncError) && (
                  <div className={`flex items-start gap-2 text-xs px-4 py-2.5 rounded-xl border max-w-md ${syncError ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'}`}>
                    {syncError ? <AlertCircle size={13} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={13} className="shrink-0 mt-0.5" />}
                    <span>{syncError || `Sucesso: ${syncAcum.criados} novos criados e ${syncAcum.atualizados} atualizados no banco local.`}</span>
                  </div>
                )}

                {/* Sincronização Delta */}
                <div className="pt-2 border-t border-brand-border/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-xl">
                  <div>
                    <h5 className="text-[11px] font-bold text-brand-text flex items-center gap-1">
                      <Activity size={10} className="text-emerald-400" />
                      Sincronização Rápida (Estoque & Preço Delta)
                    </h5>
                    <p className="text-[10px] text-brand-muted">
                      Verifica apenas produtos modificados nas últimas 48h
                    </p>
                  </div>
                  <button
                    onClick={handleSyncDelta}
                    disabled={isAnyRunning}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/20 hover:bg-emerald-950/40 disabled:opacity-50 text-emerald-400 border border-emerald-800/30 text-xs font-bold rounded-xl transition-all"
                  >
                    {loadingDelta ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                    Sync Rápido
                  </button>
                </div>
                {!loadingDelta && deltaResult && (
                  <div className={`text-xs px-4 py-2 rounded-xl border max-w-md ${deltaResult.error ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'}`}>
                    <span>{deltaResult.error || `Sync Delta concluído: ${deltaResult.estoque?.atualizados ?? 0} estoques e ${deltaResult.produtos?.atualizados ?? 0} produtos sincronizados.`}</span>
                  </div>
                )}
              </div>
            </div>

            {/* PASSO 2: Imagens e Fotos anexas */}
            <div className="flex gap-4 relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-bold text-sm shrink-0 z-10 transition-colors duration-250 ${loadingImagens ? 'bg-brand-accent border-brand-accent text-white animate-pulse' : 'bg-brand-surface-2 border-brand-border/40 text-brand-text'}`}>
                {loadingImagens ? <Loader2 size={16} className="animate-spin" /> : '2'}
              </div>
              <div className="space-y-3 flex-1 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-brand-text">
                      Passo 2 — Importar Imagens & Anexos
                    </h4>
                    <p className="text-xs text-brand-muted">
                      Varre o Tiny ERP extraindo os anexos de foto e atualiza a visibilidade
                    </p>
                  </div>
                  {!loadingImagens ? (
                    <button
                      onClick={handleBuscarImagens}
                      disabled={isAnyRunning}
                      className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-brand-accent/20"
                    >
                      <Play size={11} />
                      Importar Imagens
                    </button>
                  ) : (
                    <button
                      onClick={handlePararImagens}
                      className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 bg-brand-surface-2 hover:bg-brand-accent/20 border border-brand-border/30 text-brand-text text-xs font-bold rounded-xl transition-all"
                    >
                      <StopCircle size={11} className="text-brand-accent animate-pulse" />
                      Parar Processo
                    </button>
                  )}
                </div>

                {loadingImagens && (
                  <div className="space-y-1.5 max-w-md bg-brand-bg/50 p-3.5 rounded-xl border border-brand-border/20 animate-fade-in-up">
                    <div className="flex justify-between text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Loader2 size={10} className="animate-spin text-brand-accent" />
                        Sincronizando anexos do ERP...
                      </span>
                      <span>{pctImagens}% ({imagensAcum}/{imagensTotal ?? '?'})</span>
                    </div>
                    <div className="w-full bg-brand-surface-2 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-brand-accent h-full rounded-full transition-all duration-500" style={{ width: `${pctImagens}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-brand-muted">
                      <span>Restantes no banco: <strong>{imagensRestantes ?? '?'}</strong></span>
                      {imagensETA && <span className="font-bold text-brand-accent">{imagensETA}</span>}
                    </div>
                  </div>
                )}

                {!loadingImagens && (imagensDone || imagensError) && (
                  <div className={`flex items-start gap-2 text-xs px-4 py-2.5 rounded-xl border max-w-md ${imagensError ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'}`}>
                    {imagensError ? <AlertCircle size={13} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={13} className="shrink-0 mt-0.5" />}
                    <span>{imagensError || `Concluído: ${imagensAcum} produtos com fotos anexadas importados com sucesso.`}</span>
                  </div>
                )}

                {/* Reset de verificação */}
                <div className="pt-2 border-t border-brand-border/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 max-w-xl">
                  <div>
                    <h5 className="text-[11px] font-bold text-brand-text">Re-checar produtos marcados "Sem Foto"</h5>
                    <p className="text-[10px] text-brand-muted">Reseta a fila de verificação para tentar buscar fotos novamente</p>
                  </div>
                  <button
                    onClick={handleResetImagens}
                    disabled={isAnyRunning || loadingImagens}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-brand-surface-2 hover:bg-brand-accent/20 border border-brand-border/30 disabled:opacity-50 text-brand-text text-xs font-bold rounded-xl transition-all"
                  >
                    {loadingResetImgs ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Resetar Fila
                  </button>
                </div>
                {!loadingResetImgs && resetImgsResult && (
                  <div className="text-xs px-4 py-2 bg-brand-surface-2/40 border border-brand-border/20 rounded-xl text-brand-muted max-w-md">
                    {resetImgsResult.error || resetImgsResult.info}
                  </div>
                )}
              </div>
            </div>

            {/* PASSO 3: Estoque Físico */}
            <div className="flex gap-4 relative">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-bold text-sm shrink-0 z-10 transition-colors duration-250 ${loadingEstoque ? 'bg-brand-accent border-brand-accent text-white animate-pulse' : 'bg-brand-surface-2 border-brand-border/40 text-brand-text'}`}>
                {loadingEstoque ? <Loader2 size={16} className="animate-spin" /> : '3'}
              </div>
              <div className="space-y-2 flex-1 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-brand-text">
                      Passo 3 — Sincronizar Estoque Físico Real
                    </h4>
                    <p className="text-xs text-brand-muted">
                      Consulta e salva o saldo de estoque físico detalhado por depósito
                    </p>
                  </div>
                  <button
                    onClick={handleSyncEstoque}
                    disabled={isAnyRunning}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 bg-brand-surface-2 hover:bg-brand-accent/20 border border-brand-border/30 disabled:opacity-50 text-brand-text text-xs font-bold rounded-xl transition-all hover:-translate-y-0.5"
                  >
                    {loadingEstoque ? <Loader2 size={11} className="animate-spin" /> : <Warehouse size={11} />}
                    Sincronizar Estoque
                  </button>
                </div>

                {loadingEstoque && (
                  <div className="text-xs px-4 py-2 bg-brand-surface-2 border border-brand-border/20 rounded-xl text-brand-muted max-w-md">
                    Consultando estoque físico... {estoqueAcum} produtos processados de {estoqueTotal ?? '?'}.
                  </div>
                )}

                {!loadingEstoque && (estoqueDone || estoqueError) && (
                  <div className={`flex items-start gap-2 text-xs px-4 py-2.5 rounded-xl border max-w-md ${estoqueError ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'}`}>
                    {estoqueError ? <AlertCircle size={13} /> : <CheckCircle2 size={13} />}
                    <span>{estoqueError || `Estoque verificado com sucesso para ${estoqueAcum} produtos.`}</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── ABA 3: LIMPEZA E AJUSTES AVANÇADOS ── */}
      {activeTab === 'clean' && (
        <div className="space-y-6 animate-fade-in-up">
          <p className="text-xs font-black text-brand-muted uppercase tracking-wider">
            Ferramentas avançadas de limpeza
          </p>

          {/* Passo 0: Limpar Fantasmas */}
          <div className="p-5 bg-brand-surface-2/65 border border-brand-border/25 rounded-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-brand-text">
              <Ghost size={18} className="text-brand-accent animate-pulse" />
              <div>
                <h4 className="text-sm font-bold text-brand-text">Passo 0 — Limpar Fantasmas Automático</h4>
                <p className="text-xs text-brand-muted">
                  Compara a base local com os produtos cadastrados no Tiny e exclui permanentemente o que foi apagado no ERP. Preserva históricos de pedidos.
                </p>
              </div>
            </div>

            <button
              onClick={handleLimparFantasmas}
              disabled={isAnyRunning}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-950/20 hover:bg-red-950/40 disabled:opacity-50 text-red-400 text-xs font-bold rounded-xl border border-red-800/30 transition-all shadow-md"
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
            </button>

            {loadingFantasmas && fantasmasProgresso.totalPaginas > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-brand-muted uppercase font-bold tracking-wider">
                  <span>Varrendo catálogo Tiny ERP...</span>
                  <span>{pctFantasmas}%</span>
                </div>
                <div className="w-full bg-brand-bg rounded-full h-1 overflow-hidden">
                  <div className="bg-brand-accent h-full rounded-full transition-all" style={{ width: `${pctFantasmas}%` }} />
                </div>
              </div>
            )}

            {!loadingFantasmas && (fantasmasResult || fantasmasError) && (
              <div className={`flex items-start gap-2.5 text-xs px-4 py-3 rounded-xl border ${fantasmasError ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'}`}>
                {fantasmasError ? <AlertCircle size={13} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={13} className="shrink-0 mt-0.5" />}
                <span>
                  {fantasmasError || fantasmasResult?.msg || `Limpeza concluída com sucesso: ${fantasmasResult.deletados ?? 0} fantasmas excluídos definitivamente do banco e ${fantasmasResult.marcados ?? 0} marcados como inativos por possuírem pedidos.`}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Remover R$0,00 */}
            <div className="p-4 bg-brand-surface-2/30 border border-brand-border/20 rounded-2xl flex flex-col justify-between space-y-3">
              <div>
                <h5 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                  <Trash2 size={13} className="text-orange-400" />
                  Preço Zerado (R$ 0,00)
                </h5>
                <p className="text-[11px] text-brand-muted">
                  Exclui produtos que foram importados com preço zerado.
                </p>
              </div>
              <button
                onClick={() => handleCleanup('preco_zero')}
                disabled={isAnyRunning}
                className="w-full px-3 py-2 bg-orange-950/20 hover:bg-orange-950/40 text-orange-400 border border-orange-900/30 text-[11px] font-bold rounded-xl transition-all"
              >
                Remover Preço Zerado
              </button>
            </div>

            {/* Duplicados */}
            <div className="p-4 bg-brand-surface-2/30 border border-brand-border/20 rounded-2xl flex flex-col justify-between space-y-3">
              <div>
                <h5 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
                  <Trash2 size={13} className="text-brand-muted" />
                  Produtos Duplicados
                </h5>
                <p className="text-[11px] text-brand-muted">
                  Identifica produtos com o mesmo tinyId e mantém apenas a versão mais recente.
                </p>
              </div>
              <button
                onClick={() => handleCleanup('duplicados')}
                disabled={isAnyRunning}
                className="w-full px-3 py-2 bg-brand-surface-2 hover:bg-brand-accent/20 border border-brand-border/30 text-brand-text text-[11px] font-bold rounded-xl transition-all"
              >
                Corrigir Duplicados
              </button>
            </div>

          </div>

          {!loadingCleanup && cleanupResult && (
            <div className={`text-xs px-4 py-2.5 rounded-xl border ${cleanupResult.error ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-brand-surface-2 border-brand-border/30 text-brand-text'}`}>
              <span>{cleanupResult.error || cleanupResult.msg || `${cleanupResult.removidos} produtos removidos com sucesso.`}</span>
            </div>
          )}

          {/* ── Excluir sem foto (Ação perigosa) ── */}
          <div className="p-5 bg-brand-surface-2/45 border border-brand-border/20 rounded-2xl space-y-3">
            <h5 className="text-xs font-bold text-brand-text flex items-center gap-1.5">
              <AlertCircle size={14} className="text-amber-500" />
              Excluir produtos sem nenhuma foto
            </h5>
            <p className="text-xs text-brand-muted">
              Apaga permanentemente da base local os produtos que já foram varridos no Passo 2 e confirmados como "sem imagem" no Tiny ERP.
            </p>

            {!semImagemConfirming ? (
              <button
                onClick={handleSemImagemCount}
                disabled={isAnyRunning}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-950/20 hover:bg-amber-950/40 text-amber-500 border border-amber-900/30 text-xs font-bold rounded-xl transition-all"
              >
                <Trash2 size={12} />
                Excluir produtos sem foto
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-amber-950/10 border border-amber-800/20 rounded-xl">
                <p className="text-xs text-amber-500 font-bold text-center">
                  ⚠️ {semImagemCount} produtos sem foto no banco local serão excluídos para sempre! Essa operação é irreversível.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { setSemImagemConfirming(false); setSemImagemCount(null) }}
                    className="px-4 py-2 bg-brand-surface-2 hover:bg-brand-surface-2/80 border border-brand-border/30 text-brand-muted hover:text-brand-text text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSemImagemConfirm}
                    disabled={loadingSemImagem}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:opacity-90 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-md"
                  >
                    {loadingSemImagem ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Confirmar Exclusão
                  </button>
                </div>
              </div>
            )}

            {!loadingSemImagem && semImagemResult && (
              <div className={`text-xs px-4 py-2.5 rounded-xl border ${semImagemResult.error ? 'bg-red-950/20 border-red-900/30 text-red-400' : 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400'}`}>
                <span>{semImagemResult.error || semImagemResult.msg || `${semImagemResult.removidos} produtos sem fotos excluídos com sucesso.`}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer / Nota */}
      <div className="border-t border-brand-border/20 pt-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-brand-muted uppercase font-bold tracking-wider">
        <span>Canal integrado: Olist ERP (Tiny)</span>
        <span>Webhook e WebHooks delta integrados de forma segura</span>
      </div>

    </div>
  )
}
