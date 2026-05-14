'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, Loader2,
  Package, Image as ImageIcon, Warehouse, Trash2,
  RotateCcw, ArrowUpRight, Activity, Ghost,
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
    zinc:   'bg-zinc-800 text-zinc-300',
    green:  'bg-green-900/40 text-green-400',
    red:    'bg-red-900/40 text-red-400',
    yellow: 'bg-yellow-900/40 text-yellow-400',
    blue:   'bg-blue-900/40 text-blue-400',
  }
  return (
    <div className={`rounded-md px-3 py-2 ${colors[color] ?? colors.zinc}`}>
      <div className="text-[18px] font-black leading-none">{value}</div>
      <div className="text-[10px] mt-0.5 opacity-70">{label}</div>
    </div>
  )
}

export function OlistSyncButton() {

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

  // ── Outros cleanups ──────────────────────────────────────────────────────────
  const [loadingCleanup, setLoadingCleanup] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<any>(null)

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
    setLoadingImagens(true); setImagensDone(false); setImagensError('')
    let totalAcum = 0, desativAcum = 0, totalInicial: number | null = null

    while (true) {
      try {
        const res = await fetch('/api/olist/imagens', { method: 'POST' })
        const data = await res.json()
        if (data.error) { setImagensError(data.error); break }

        totalAcum += data.atualizados ?? 0
        desativAcum += data.naoEncontradosNoTiny ?? 0
        setImagensAcum(totalAcum)
        setImagensDesativ(desativAcum)
        setImagensRestantes(data.restantes ?? 0)
        setImagensNaoVerif(data.naoVerificados ?? 0)

        if (totalInicial === null && data.restantes != null) {
          totalInicial = data.restantes + totalAcum
          setImagensTotal(totalInicial)
        }

        if (!data.hasMore) { setImagensDone(true); break }
        await new Promise(r => setTimeout(r, 1200)) // reduzido de 2s para 1.2s
      } catch { setImagensError('Erro de conexão'); break }
    }
    setLoadingImagens(false)
    fetchDiag()
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

    // ── Fase B: Marcar fantasmas no banco ────────────────────────────────────
    setFantasmasStep('marcando')
    try {
      const res: Response = await fetch('/api/admin/marcar-fantasmas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fase: 'marcar', skusTiny: todosSkus }),
      })
      const data = await res.json()
      if (data.error) { setFantasmasError(data.error); setLoadingFantasmas(false); setFantasmasStep('idle'); return }

      if (data.marcados > 0) {
        // ── Fase C: Deletar os marcados ────────────────────────────────────
        setFantasmasStep('deletando')
        try {
          const resDel: Response = await fetch('/api/admin/cleanup-produtos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: 'inativos' }),
          })
          const textDel = await resDel.text()
          let dataDel: any = {}
          try { dataDel = JSON.parse(textDel) } catch { /* body inválido */ }
          setFantasmasResult({
            ...data,
            deletados: dataDel.removidos ?? 0,
            msg: dataDel.msg ?? data.msg,
          })
        } catch {
          // Mesmo se o delete falhar, mostra que marcou os fantasmas
          setFantasmasResult({ ...data, deletados: 0 })
        }
      } else {
        setFantasmasResult(data)
      }
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

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white text-sm">Sincronização OLIST / Tiny</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Cron automático diário às 6h · Webhook ativo</p>
        </div>
        <button onClick={fetchDiag} disabled={loadingDiag}
          className="flex items-center gap-1 px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs rounded transition-colors">
          {loadingDiag ? <Loader2 size={11} className="animate-spin" /> : <Activity size={11} />}
          Atualizar
        </button>
      </div>

      {/* ── Diagnóstico ── */}
      {diag && (
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Estado do banco agora
          </p>
          <div className="grid grid-cols-3 gap-2">
            <StatBadge label="Total produtos" value={diag.total} color="zinc" />
            <StatBadge label="Ativos" value={diag.ativos} color="green" />
            <StatBadge label="Fantasmas (inativos)" value={diag.inativos} color={diag.inativos > 0 ? 'red' : 'zinc'} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatBadge label="Com imagem" value={`${diag.ativosComImagem} (${diag.pctComImagem}%)`} color={diag.pctComImagem >= 80 ? 'green' : 'yellow'} />
            <StatBadge label="Sem imagem" value={diag.ativosSemImagem} color={diag.ativosSemImagem > 200 ? 'red' : diag.ativosSemImagem > 0 ? 'yellow' : 'zinc'} />
            <StatBadge label="Não verificados" value={diag.naoVerificados} color={diag.naoVerificados > 0 ? 'yellow' : 'zinc'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatBadge label="Em estoque" value={`${diag.emEstoque} (${diag.pctEmEstoque}%)`} color="blue" />
            <StatBadge label="Zerado" value={diag.semEstoque} color="zinc" />
          </div>

          {/* Barra de progresso de imagens */}
          <div>
            <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
              <span>Cobertura de imagens</span>
              <span>{diag.pctComImagem}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${diag.pctComImagem}%`,
                  background: diag.pctComImagem >= 80 ? '#22c55e' : diag.pctComImagem >= 50 ? '#eab308' : '#ef4444'
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-zinc-800" />

      {/* ── PASSO 0: Limpar fantasmas ── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Ghost size={14} className="text-red-400" />
          <div>
            <span className="text-red-300 font-medium">Passo 0 — Limpar fantasmas</span>
            <p className="text-[11px] text-zinc-600">
              Compara TODOS os SKUs do banco com o Tiny e remove os que não existem mais
            </p>
          </div>
        </div>

        <button
          onClick={handleLimparFantasmas}
          disabled={loadingFantasmas}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/50 hover:bg-red-900/80 disabled:opacity-50 text-red-300 text-sm font-semibold rounded-md border border-red-800/50 transition-all"
        >
          {loadingFantasmas ? <Loader2 size={13} className="animate-spin" /> : <Ghost size={13} />}
          {loadingFantasmas
            ? fantasmasStep === 'coletando'
              ? `Coletando SKUs do Tiny… ${fantasmasProgresso.pagina}/${fantasmasProgresso.totalPaginas} páginas (${fantasmasProgresso.skusColetados} SKUs)`
              : fantasmasStep === 'marcando'
              ? 'Marcando fantasmas no banco…'
              : 'Deletando fantasmas…'
            : 'Limpar fantasmas automaticamente'
          }
        </button>

        {loadingFantasmas && fantasmasProgresso.totalPaginas > 0 && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Páginas Tiny: {fantasmasProgresso.pagina}/{fantasmasProgresso.totalPaginas}</span>
              <span>{pctFantasmas}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1">
              <div className="bg-red-500 h-1 rounded-full transition-all" style={{ width: `${pctFantasmas}%` }} />
            </div>
          </div>
        )}

        {!loadingFantasmas && (fantasmasResult || fantasmasError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${fantasmasError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {fantasmasError
              ? <AlertCircle size={12} className="shrink-0 mt-0.5" />
              : <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
            }
            <span>{fantasmasError || fantasmasResult?.msg || (fantasmasResult?.deletados != null ? `${fantasmasResult.deletados} fantasmas deletados · Tiny: ${fantasmasResult.totalTiny} SKUs` : JSON.stringify(fantasmasResult))}</span>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      {/* ── PASSO 1: Produtos ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Package size={14} className="text-zinc-500" />
            <div>
              <span>Passo 1 — Importar produtos</span>
              <p className="text-[11px] text-zinc-600">Importa nome, preço e situação do Tiny</p>
            </div>
          </div>
          <button onClick={handleSyncMetadados} disabled={loadingSync}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-vermelho hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingSync ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loadingSync ? `Pág. ${syncPagina}/${syncTotal}…` : 'Sincronizar'}
          </button>
        </div>
        {loadingSync && syncTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Página {syncPagina} de {syncTotal}</span><span>{pctSync}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1">
              <div className="bg-vermelho h-1 rounded-full transition-all" style={{ width: `${pctSync}%` }} />
            </div>
          </div>
        )}
        {!loadingSync && (syncDone || syncError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${syncError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {syncError ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
            <span>{syncError || `${syncAcum.criados} criados · ${syncAcum.atualizados} atualizados`}</span>
          </div>
        )}
      </div>

      {/* ── PASSO 2: Imagens ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <ImageIcon size={14} className="text-zinc-500" />
            <div>
              <span>Passo 2 — Importar imagens</span>
              <p className="text-[11px] text-zinc-600">
                Busca fotos no Tiny (20 por vez · automático)
                {diag && diag.ativosSemImagem > 0 && (
                  <span className="text-yellow-500"> · {diag.ativosSemImagem} pendentes</span>
                )}
              </p>
            </div>
          </div>
          <button onClick={handleBuscarImagens} disabled={loadingImagens}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingImagens ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
            {loadingImagens
              ? `${imagensAcum} salvas · ${imagensNaoVerif ?? '?'} pendentes`
              : 'Buscar imagens'
            }
          </button>
        </div>

        {loadingImagens && imagensTotal && imagensTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>{imagensAcum}/{imagensTotal} imagens processadas</span>
              <span>{pctImagens}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1">
              <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${pctImagens}%` }} />
            </div>
            {imagensDesativ > 0 && (
              <p className="text-[10px] text-orange-400 mt-0.5">{imagensDesativ} fantasmas detectados e desativados durante o processo</p>
            )}
          </div>
        )}

        {!loadingImagens && (imagensDone || imagensError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${imagensError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {imagensError ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
            <span>
              {imagensError || (
                `${imagensAcum} imagens importadas` +
                (imagensDesativ > 0 ? ` · ${imagensDesativ} fantasmas desativados` : '') +
                ` · ${imagensRestantes ?? 0} ainda sem foto`
              )}
            </span>
          </div>
        )}

        {/* Reset imagens */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
          <div>
            <p className="text-[11px] text-zinc-500">Resetar verificação</p>
            <p className="text-[10px] text-zinc-700">Força re-busca de todos os produtos sem foto</p>
          </div>
          <button onClick={handleResetImagens} disabled={loadingResetImgs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/50 hover:bg-blue-700 disabled:opacity-50 text-white text-xs rounded-md transition-colors">
            {loadingResetImgs ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            Resetar
          </button>
        </div>
        {!loadingResetImgs && resetImgsResult && (
          <div className={`text-xs px-3 py-2 rounded-md ${resetImgsResult.error ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
            {resetImgsResult.error || resetImgsResult.info}
          </div>
        )}
      </div>

      {/* ── PASSO 3: Estoque ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Warehouse size={14} className="text-zinc-500" />
            <div>
              <span>Passo 3 — Estoque físico</span>
              <p className="text-[11px] text-zinc-600">Saldo real do Tiny (5 por vez · lento)</p>
            </div>
          </div>
          <button onClick={handleSyncEstoque} disabled={loadingEstoque}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs rounded-md transition-colors">
            {loadingEstoque ? <Loader2 size={12} className="animate-spin" /> : <Warehouse size={12} />}
            {loadingEstoque ? `${estoqueAcum} atualizados…` : 'Sync estoque'}
          </button>
        </div>
        {!loadingEstoque && (estoqueDone || estoqueError) && (
          <div className={`text-xs px-3 py-2 rounded-md ${estoqueError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {estoqueError || `${estoqueAcum} verificados`}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      {/* ── Limpeza manual ── */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Limpeza manual adicional</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleCleanup('preco_zero')} disabled={loadingCleanup}
            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-orange-900/30 hover:bg-orange-900/50 disabled:opacity-40 text-orange-300 text-[11px] rounded transition-colors">
            {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Remover R$0,00
          </button>
          <button onClick={() => handleCleanup('duplicados')} disabled={loadingCleanup}
            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-zinc-700/60 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-[11px] rounded transition-colors">
            {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Duplicados
          </button>
        </div>
        <button onClick={() => handleCleanup('inativos')} disabled={loadingCleanup}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-40 text-red-300 text-[11px] rounded transition-colors">
          {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Excluir inativos já marcados
        </button>
        {!loadingCleanup && cleanupResult && (
          <div className={`text-xs px-3 py-2 rounded-md ${cleanupResult.error ? 'bg-red-900/30 text-red-400' : 'bg-zinc-800 text-zinc-300'}`}>
            {cleanupResult.error || `${cleanupResult.removidos} removidos`}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
          <ArrowUpRight size={11} className="text-green-500" />
          Pedidos enviados automaticamente ao Tiny · Status financeiro gerenciado no Tiny.
        </p>
      </div>
    </div>
  )
}
