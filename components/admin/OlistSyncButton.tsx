'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Package, ShoppingBag, Image as ImageIcon } from 'lucide-react'

export function OlistSyncButton() {
  // ── Fase 1: sync metadados ─────────────────────────────────────────────────
  const [loadingSync, setLoadingSync] = useState(false)
  const [syncPagina, setSyncPagina] = useState(0)
  const [syncTotal, setSyncTotal] = useState(0)
  const [syncAcum, setSyncAcum] = useState({ criados: 0, atualizados: 0, erros: 0 })
  const [syncDone, setSyncDone] = useState(false)
  const [syncError, setSyncError] = useState('')

  // ── Fase 2: buscar imagens ─────────────────────────────────────────────────
  const [loadingImagens, setLoadingImagens] = useState(false)
  const [imagensRestantes, setImagensRestantes] = useState<number | null>(null)
  const [imagensAcum, setImagensAcum] = useState(0)
  const [imagensError, setImagensError] = useState('')
  const [imagensDone, setImagensDone] = useState(false)

  // ── Fase 3: sync pedidos ───────────────────────────────────────────────────
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [pedidosResult, setPedidosResult] = useState<any>(null)

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

        if (!data.hasMore) { setImagensDone(true); break }
        // Aguarda 2s antes do próximo lote (evita rate limit)
        await new Promise(r => setTimeout(r, 2000))
      } catch {
        setImagensError('Erro de conexão')
        break
      }
    }
    setLoadingImagens(false)
  }

  async function handleSyncPedidos() {
    setLoadingPedidos(true)
    setPedidosResult(null)
    try {
      const res = await fetch('/api/olist/pedidos', { method: 'POST' })
      setPedidosResult(await res.json())
    } catch {
      setPedidosResult({ error: 'Erro de conexão' })
    } finally {
      setLoadingPedidos(false)
    }
  }

  const pctSync = syncTotal > 0 ? Math.round((syncPagina / syncTotal) * 100) : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-white text-sm">Sincronização OLIST / Tiny</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Cron automático diário às 6h</p>
      </div>

      {/* ── Fase 1: Metadados ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Package size={14} className="text-zinc-500" />
            <div>
              <span>Passo 1 — Produtos</span>
              <p className="text-[11px] text-zinc-600">Importa nome, preço e estoque (rápido)</p>
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
            <span>
              {syncError || `${syncAcum.criados} criados · ${syncAcum.atualizados} atualizados · ${syncAcum.erros} erros`}
            </span>
          </div>
        )}
      </div>

      {/* ── Fase 2: Imagens ── */}
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
            {loadingImagens ? `${imagensAcum} foto(s)…` : 'Buscar imagens'}
          </button>
        </div>

        {imagensRestantes !== null && (
          <p className="text-[11px] text-zinc-600">
            {imagensRestantes > 0 ? `${imagensRestantes} produtos ainda sem imagem` : 'Todos os produtos têm imagem ✓'}
          </p>
        )}

        {!loadingImagens && (imagensDone || imagensError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${imagensError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {imagensError ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
            <span>{imagensError || `${imagensAcum} imagens importadas${imagensRestantes ? ` · ${imagensRestantes} restantes` : ' · Concluído!'}`}</span>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      {/* ── Fase 3: Pedidos ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <ShoppingBag size={14} className="text-zinc-500" />
          <div>
            <span>Status de pedidos</span>
            <p className="text-[11px] text-zinc-600">Atualiza rastreio do Tiny</p>
          </div>
        </div>
        <button onClick={handleSyncPedidos} disabled={loadingPedidos}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
          {loadingPedidos ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {loadingPedidos ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      {!loadingPedidos && pedidosResult && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${pedidosResult.error ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
          {pedidosResult.error ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
          <span>
            {pedidosResult.error || `${pedidosResult.totalTiny ?? 0} pedidos · ${pedidosResult.atualizados ?? 0} atualizados`}
          </span>
        </div>
      )}
    </div>
  )
}
