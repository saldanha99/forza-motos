'use client'

import { useState } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, Loader2,
  Package, Image as ImageIcon, Warehouse, Trash2,
  RotateCcw, ArrowUpRight,
} from 'lucide-react'

export function OlistSyncButton() {
  // ── Fase 1: Produtos ──────────────────────────────────────────────────────
  const [loadingSync, setLoadingSync] = useState(false)
  const [syncPagina, setSyncPagina] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)
  const [syncAcum, setSyncAcum] = useState({ criados: 0, atualizados: 0, erros: 0 })
  const [syncDone, setSyncDone] = useState(false)
  const [syncError, setSyncError] = useState('')

  // ── Fase 2: Imagens ───────────────────────────────────────────────────────
  const [loadingImagens, setLoadingImagens] = useState(false)
  const [imagensRestantes, setImagensRestantes] = useState<number | null>(null)
  const [imagensNaoVerificadas, setImagensNaoVerificadas] = useState<number | null>(null)
  const [imagensAcum, setImagensAcum] = useState(0)
  const [imagensError, setImagensError] = useState('')
  const [imagensDone, setImagensDone] = useState(false)

  // ── Reset de imagens ──────────────────────────────────────────────────────
  const [loadingResetImgs, setLoadingResetImgs] = useState(false)
  const [resetImgsResult, setResetImgsResult] = useState<any>(null)

  // ── Fase 3: Estoque físico ────────────────────────────────────────────────
  const [loadingEstoque, setLoadingEstoque] = useState(false)
  const [estoqueAcum, setEstoqueAcum] = useState(0)
  const [estoqueZerados, setEstoqueZerados] = useState<number | null>(null)
  const [estoqueTotal, setEstoqueTotal] = useState<number | null>(null)
  const [estoqueError, setEstoqueError] = useState('')
  const [estoqueDone, setEstoqueDone] = useState(false)

  // ── Reconciliação ─────────────────────────────────────────────────────────
  const [loadingRecon, setLoadingRecon] = useState(false)
  const [reconResult, setReconResult] = useState<any>(null)

  // ── Limpeza de produtos ───────────────────────────────────────────────────
  const [loadingCleanup, setLoadingCleanup] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<any>(null)

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSyncMetadados() {
    setLoadingSync(true)
    setSyncDone(false)
    setSyncError('')
    setSyncPagina(0)
    setSyncTotal(0)
    setSyncAcum({ criados: 0, atualizados: 0, erros: 0 })

    let pagina = 1
    let acum = { criados: 0, atualizados: 0, erros: 0 }

    while (true) {
      try {
        const res = await fetch('/api/olist/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pagina }),
        })
        const data = await res.json()
        if (data.error) { setSyncError(data.error); break }

        acum = {
          criados:     acum.criados     + (data.criados     ?? 0),
          atualizados: acum.atualizados + (data.atualizados ?? 0),
          erros:       acum.erros       + (data.erros       ?? 0),
        }
        setSyncAcum(acum)
        setSyncPagina(data.paginaAtual ?? pagina)
        setSyncTotal(data.totalPaginas ?? 1)

        if (!data.hasMore) { setSyncDone(true); break }
        pagina++
      } catch {
        setSyncError('Erro de conexão com o servidor')
        break
      }
    }
    setLoadingSync(false)
  }

  async function handleBuscarImagens() {
    setLoadingImagens(true)
    setImagensDone(false)
    setImagensError('')
    let totalAcum = 0

    while (true) {
      try {
        const res = await fetch('/api/olist/imagens', { method: 'POST' })
        const data = await res.json()
        if (data.error) { setImagensError(data.error); break }

        totalAcum += data.atualizados ?? 0
        setImagensAcum(totalAcum)
        setImagensRestantes(data.restantes ?? 0)
        setImagensNaoVerificadas(data.naoVerificados ?? 0)

        if (!data.hasMore) { setImagensDone(true); break }
        await new Promise(r => setTimeout(r, 3000))
      } catch {
        setImagensError('Erro de conexão')
        break
      }
    }
    setLoadingImagens(false)
  }

  async function handleResetImagens() {
    setLoadingResetImgs(true)
    setResetImgsResult(null)
    try {
      const res = await fetch('/api/admin/reset-imgs', { method: 'POST' })
      setResetImgsResult(await res.json())
    } catch {
      setResetImgsResult({ error: 'Erro de conexão' })
    } finally {
      setLoadingResetImgs(false)
    }
  }

  async function handleSyncEstoque() {
    setLoadingEstoque(true)
    setEstoqueDone(false)
    setEstoqueError('')
    let acum = 0

    while (true) {
      try {
        const res = await fetch('/api/olist/estoque', { method: 'POST' })
        const data = await res.json()
        if (data.error) { setEstoqueError(data.error); break }

        acum += data.atualizados ?? 0
        setEstoqueAcum(acum)
        setEstoqueZerados(data.pendentes ?? 0)
        setEstoqueTotal(data.total ?? null)

        if (!data.hasMore) { setEstoqueDone(true); break }
        await new Promise(r => setTimeout(r, 6000))
      } catch {
        setEstoqueError('Erro de conexão')
        break
      }
    }
    setLoadingEstoque(false)
  }

  async function handleCleanup(tipo: string) {
    setLoadingCleanup(true)
    setCleanupResult(null)
    try {
      const res = await fetch('/api/admin/cleanup-produtos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      })
      setCleanupResult(await res.json())
    } catch {
      setCleanupResult({ error: 'Erro de conexão' })
    } finally {
      setLoadingCleanup(false)
    }
  }

  async function handleReconciliar() {
    setLoadingRecon(true)
    setReconResult(null)
    try {
      const res = await fetch('/api/olist/reconciliar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutosAtras: 90 }),
      })
      setReconResult(await res.json())
    } catch {
      setReconResult({ error: 'Erro de conexão' })
    } finally {
      setLoadingRecon(false)
    }
  }

  const pctSync = syncTotal > 0 ? Math.round((syncPagina / syncTotal) * 100) : 0
  const pctEstoque = estoqueTotal && estoqueZerados !== null
    ? Math.round(((estoqueTotal - estoqueZerados) / estoqueTotal) * 100) : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">

      {/* Header */}
      <div>
        <h3 className="font-semibold text-white text-sm">Sincronização OLIST / Tiny</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Cron automático diário às 6h · Webhook em tempo real ativo</p>
      </div>

      {/* Fluxo de dados — informativo */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 flex flex-col gap-1.5">
        <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wide mb-0.5">Arquitetura de dados</p>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-blue-400 font-mono">Tiny</span>
          <span className="text-zinc-600">→</span>
          <span className="text-zinc-300">Produtos · Estoque · Imagens · Novos produtos</span>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-green-400 font-mono">Nosso site</span>
          <ArrowUpRight size={12} className="text-zinc-600" />
          <span className="text-zinc-300">Pedidos enviados ao Tiny (automático)</span>
        </div>
        <p className="text-[10px] text-zinc-600 mt-0.5">
          Dados financeiros e retorno de pedidos ficam 100% no Tiny — não puxamos de lá.
        </p>
      </div>

      {/* ── Passo 1: Produtos ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Package size={14} className="text-zinc-500" />
            <div>
              <span>Passo 1 — Produtos</span>
              <p className="text-[11px] text-zinc-600">Importa nome, preço e situação (rápido)</p>
            </div>
          </div>
          <button onClick={handleSyncMetadados} disabled={loadingSync}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-vermelho hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingSync ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loadingSync ? `Página ${syncPagina}/${syncTotal}…` : 'Sincronizar'}
          </button>
        </div>

        {loadingSync && syncTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Página {syncPagina} de {syncTotal}</span>
              <span>{pctSync}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1">
              <div className="bg-vermelho h-1 rounded-full transition-all" style={{ width: `${pctSync}%` }} />
            </div>
          </div>
        )}

        {!loadingSync && (syncDone || syncError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${syncError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {syncError ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
            <span>{syncError || `${syncAcum.criados} criados · ${syncAcum.atualizados} atualizados · ${syncAcum.erros} erros`}</span>
          </div>
        )}
      </div>

      {/* ── Passo 2: Imagens ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <ImageIcon size={14} className="text-zinc-500" />
            <div>
              <span>Passo 2 — Imagens</span>
              <p className="text-[11px] text-zinc-600">Busca fotos dos produtos (3 por vez)</p>
            </div>
          </div>
          <button onClick={handleBuscarImagens} disabled={loadingImagens}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingImagens ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
            {loadingImagens ? `${imagensAcum} foto(s) · ${imagensNaoVerificadas ?? '…'} pendentes` : 'Buscar imagens'}
          </button>
        </div>

        {!loadingImagens && imagensRestantes !== null && (
          <p className="text-[11px] text-zinc-600">
            {imagensRestantes > 0 ? `${imagensRestantes} produtos sem imagem no banco` : 'Todos os produtos têm imagem ✓'}
          </p>
        )}

        {!loadingImagens && (imagensDone || imagensError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${imagensError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {imagensError ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
            <span>{imagensError || `${imagensAcum} imagens encontradas · ${imagensRestantes ?? 0} sem foto no Tiny`}</span>
          </div>
        )}

        {/* Reset imagens — forçar re-sincronização */}
        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60">
          <div>
            <p className="text-[11px] text-zinc-500">Resetar verificação de imagens</p>
            <p className="text-[10px] text-zinc-700">Use se imagens foram adicionadas no Tiny recentemente</p>
          </div>
          <button onClick={handleResetImagens} disabled={loadingResetImgs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/60 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingResetImgs ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            {loadingResetImgs ? 'Resetando…' : 'Resetar'}
          </button>
        </div>

        {!loadingResetImgs && resetImgsResult && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${resetImgsResult.error ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
            {resetImgsResult.error ? <AlertCircle size={12} className="shrink-0" /> : <RotateCcw size={12} className="shrink-0" />}
            <span>{resetImgsResult.error || resetImgsResult.info}</span>
          </div>
        )}
      </div>

      {/* ── Passo 3: Estoque físico ── */}
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingEstoque ? <Loader2 size={12} className="animate-spin" /> : <Warehouse size={12} />}
            {loadingEstoque ? `${estoqueAcum} atualizados…` : 'Sync estoque'}
          </button>
        </div>

        {loadingEstoque && estoqueTotal !== null && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>{estoqueZerados} pendentes</span>
              <span>{pctEstoque}% verificados</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1">
              <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${pctEstoque}%` }} />
            </div>
          </div>
        )}

        {!loadingEstoque && (estoqueDone || estoqueError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${estoqueError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {estoqueError ? <AlertCircle size={12} className="shrink-0" /> : <CheckCircle2 size={12} className="shrink-0" />}
            <span>{estoqueError || `${estoqueAcum} verificados · ${estoqueZerados ?? 0} pendentes`}</span>
          </div>
        )}

        <p className="text-[10px] text-zinc-700">
          Webhook ativo — qualquer lançamento no Tiny atualiza o site automaticamente
        </p>
      </div>

      <div className="border-t border-zinc-800" />

      {/* ── Reconciliação ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Trash2 size={14} className="text-zinc-500" />
            <div>
              <span>Limpar fantasmas</span>
              <p className="text-[11px] text-zinc-600">Desativa produtos removidos do Tiny</p>
            </div>
          </div>
          <button onClick={handleReconciliar} disabled={loadingRecon}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingRecon ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            {loadingRecon ? 'Verificando…' : 'Reconciliar'}
          </button>
        </div>

        {!loadingRecon && reconResult && (
          <div className={`flex flex-col gap-1 text-xs px-3 py-2 rounded-md ${reconResult.error ? 'bg-red-900/30 text-red-400' : reconResult.desativados > 0 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
            <div className="flex items-center gap-2">
              {reconResult.error ? <AlertCircle size={12} className="shrink-0" /> : reconResult.desativados > 0 ? <AlertCircle size={12} className="shrink-0" /> : <CheckCircle2 size={12} className="shrink-0" />}
              <span>
                {reconResult.error ||
                  (reconResult.desativados > 0
                    ? `${reconResult.desativados} fantasmas desativados`
                    : `Nenhum fantasma · ${reconResult.totalAtivos ?? 0} produtos OK`
                  )
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Limpeza de Banco ── */}
      <div className="border-t border-zinc-800 pt-4 space-y-3">
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">Limpeza de banco</p>
          <p className="text-[10px] text-zinc-600">Remova produtos inválidos ou que já não existem no Tiny</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => handleCleanup('preco_zero')} disabled={loadingCleanup}
            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-orange-900/40 hover:bg-orange-900/60 disabled:opacity-40 text-orange-300 text-[11px] font-medium rounded transition-colors">
            {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Remover R$0,00
          </button>
          <button onClick={() => handleCleanup('duplicados')} disabled={loadingCleanup}
            className="flex items-center justify-center gap-1.5 px-2 py-2 bg-zinc-700/60 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-[11px] font-medium rounded transition-colors">
            {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Remover duplicados
          </button>
        </div>

        <button onClick={() => handleCleanup('sync_tiny')} disabled={loadingCleanup}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-40 text-red-300 text-[11px] font-medium rounded transition-colors">
          {loadingCleanup ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Sync completo com Tiny — remove SKUs ausentes (lento)
        </button>

        {!loadingCleanup && cleanupResult && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${cleanupResult.error ? 'bg-red-900/30 text-red-400' : 'bg-zinc-800 text-zinc-300'}`}>
            {cleanupResult.error
              ? <AlertCircle size={12} className="shrink-0 mt-0.5" />
              : <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-green-400" />
            }
            <span>
              {cleanupResult.error || (
                cleanupResult.tipo === 'sync_tiny'
                  ? `${cleanupResult.removidos} removidos · Tiny: ${cleanupResult.skusTiny} SKUs · Banco era: ${cleanupResult.totalBanco}`
                  : `${cleanupResult.removidos} produtos removidos`
              )}
            </span>
          </div>
        )}
      </div>

      {/* ── Info pedidos (apenas informativo) ── */}
      <div className="border-t border-zinc-800 pt-3">
        <p className="text-[11px] text-zinc-600 flex items-center gap-1.5">
          <ArrowUpRight size={11} className="text-green-500" />
          Pedidos do site são enviados automaticamente ao Tiny no momento da compra.
          Status e dados financeiros são gerenciados 100% dentro do Tiny.
        </p>
      </div>

    </div>
  )
}
