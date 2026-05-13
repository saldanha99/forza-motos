'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Package, ShoppingBag, Image as ImageIcon, Warehouse, Trash2, ScanSearch } from 'lucide-react'

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
  const [imagensNaoVerificadas, setImagensNaoVerificadas] = useState<number | null>(null)
  const [imagensAcum, setImagensAcum] = useState(0)
  const [imagensError, setImagensError] = useState('')
  const [imagensDone, setImagensDone] = useState(false)
  const [tinyNaoTemImagens, setTinyNaoTemImagens] = useState(false)

  // ── Fase 3: sync pedidos ───────────────────────────────────────────────────
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [pedidosResult, setPedidosResult] = useState<any>(null)

  // ── Limpar imagens duplicadas ──────────────────────────────────────────────
  const [loadingLimparImgs, setLoadingLimparImgs] = useState(false)
  const [limparImgsResult, setLimparImgsResult] = useState<any>(null)

  // ── Reconciliação: remove fantasmas ───────────────────────────────────────
  const [loadingRecon, setLoadingRecon] = useState(false)
  const [reconResult, setReconResult] = useState<any>(null)

  // ── Fase 4: sync estoque físico ────────────────────────────────────────────
  const [loadingEstoque, setLoadingEstoque] = useState(false)
  const [estoqueAcum, setEstoqueAcum] = useState(0)
  const [estoqueZerados, setEstoqueZerados] = useState<number | null>(null)
  const [estoqueTotal, setEstoqueTotal] = useState<number | null>(null)
  const [estoqueError, setEstoqueError] = useState('')
  const [estoqueDone, setEstoqueDone] = useState(false)

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
    setTinyNaoTemImagens(false)
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

        // Informa se o lote atual não tinha imagens (mas não para o processo)
        if (data.tinyNaoTemImagens) setTinyNaoTemImagens(true)
        else setTinyNaoTemImagens(false)

        // Para apenas quando não há mais produtos não verificados
        if (!data.hasMore) { setImagensDone(true); break }
        // Delay entre lotes (10 produtos × 1.2s de rate limit do Tiny)
        await new Promise(r => setTimeout(r, 3000))
      } catch {
        setImagensError('Erro de conexão')
        break
      }
    }
    setLoadingImagens(false)
  }

  async function handleLimparImgsDuplicadas() {
    setLoadingLimparImgs(true)
    setLimparImgsResult(null)
    try {
      const res = await fetch('/api/admin/limpar-imgs-duplicadas', { method: 'POST' })
      setLimparImgsResult(await res.json())
    } catch {
      setLimparImgsResult({ error: 'Erro de conexão' })
    } finally {
      setLoadingLimparImgs(false)
    }
  }

  async function handleReconciliar() {
    setLoadingRecon(true)
    setReconResult(null)
    try {
      // Usa uma janela de 90 min — o sync completo leva ~5 min
      // Produtos não tocados no sync recente são fantasmas
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
        setEstoqueZerados(data.pendentes ?? data.zerados ?? 0)
        setEstoqueTotal(data.total ?? null)

        if (!data.hasMore) { setEstoqueDone(true); break }
        // 6s entre lotes (5 produtos × 1.2s delay cada)
        await new Promise(r => setTimeout(r, 6000))
      } catch {
        setEstoqueError('Erro de conexão')
        break
      }
    }
    setLoadingEstoque(false)
  }

  const pctSync = syncTotal > 0 ? Math.round((syncPagina / syncTotal) * 100) : 0
  const pctEstoque = estoqueTotal && estoqueZerados !== null
    ? Math.round(((estoqueTotal - estoqueZerados) / estoqueTotal) * 100)
    : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
      <div>
        <h3 className="font-semibold text-white text-sm">Sincronização OLIST / Tiny</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Cron automático diário às 6h · Webhook em tempo real ativo</p>
      </div>

      {/* ── Fase 1: Metadados ── */}
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
            {loadingImagens ? `${imagensAcum} foto(s) · ${imagensNaoVerificadas ?? '…'} pendentes` : 'Buscar imagens'}
          </button>
        </div>

        {loadingImagens && imagensNaoVerificadas !== null && (
          <p className="text-[11px] text-zinc-500">
            {imagensNaoVerificadas > 0
              ? `${imagensNaoVerificadas} produtos ainda não verificados`
              : 'Verificação concluída!'}
            {tinyNaoTemImagens && <span className="text-yellow-600"> · Lote atual sem fotos no Tiny</span>}
          </p>
        )}

        {!loadingImagens && imagensRestantes !== null && (
          <p className="text-[11px] text-zinc-600">
            {imagensRestantes > 0 ? `${imagensRestantes} produtos sem imagem no banco` : 'Todos os produtos têm imagem ✓'}
          </p>
        )}

        {!loadingImagens && (imagensDone || imagensError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${
            imagensError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
          }`}>
            {imagensError
              ? <AlertCircle size={12} className="mt-0.5 shrink-0" />
              : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
            <span>
              {imagensError ||
                `${imagensAcum} produtos verificados · ${imagensRestantes ?? 0} sem foto cadastrada no Tiny`
              }
            </span>
          </div>
        )}
      </div>

      {/* ── Fase 4: Estoque físico ── */}
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
            {loadingEstoque
              ? `${estoqueAcum} atualizados…`
              : 'Sync estoque'}
          </button>
        </div>

        {loadingEstoque && estoqueTotal !== null && (
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>{estoqueZerados} ainda pendentes</span>
              <span>{estoqueTotal ? Math.round(((estoqueTotal - (estoqueZerados ?? 0)) / estoqueTotal) * 100) : 0}% verificados</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1">
              <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${pctEstoque}%` }} />
            </div>
          </div>
        )}

        {!loadingEstoque && (estoqueDone || estoqueError) && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${estoqueError ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
            {estoqueError ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={12} className="mt-0.5 shrink-0" />}
            <span>
              {estoqueError || `${estoqueAcum} verificados · ${estoqueZerados ?? 0} pendentes`}
            </span>
          </div>
        )}

        <p className="text-[11px] text-zinc-700">
          Webhook ativo — qualquer lançamento no Tiny atualiza o site automaticamente
        </p>
      </div>

      <div className="border-t border-zinc-800" />

      {/* ── Fase 3→4: Pedidos ── */}
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

      <div className="border-t border-zinc-800" />

      {/* ── Limpar imagens duplicadas ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <ScanSearch size={14} className="text-zinc-500" />
            <div>
              <span>Imagens repetidas</span>
              <p className="text-[11px] text-zinc-600">Detecta e limpa fotos erradas/padrão</p>
            </div>
          </div>
          <button onClick={handleLimparImgsDuplicadas} disabled={loadingLimparImgs}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors">
            {loadingLimparImgs ? <Loader2 size={12} className="animate-spin" /> : <ScanSearch size={12} />}
            {loadingLimparImgs ? 'Verificando…' : 'Limpar duplicadas'}
          </button>
        </div>
        <p className="text-[11px] text-zinc-700">
          Se todos os produtos mostram a mesma foto, use isso antes de "Buscar imagens"
        </p>
        {!loadingLimparImgs && limparImgsResult && (
          <div className={`flex flex-col gap-1 text-xs px-3 py-2 rounded-md ${
            limparImgsResult.error ? 'bg-red-900/30 text-red-400'
            : limparImgsResult.resetados > 0 ? 'bg-orange-900/30 text-orange-400'
            : 'bg-green-900/30 text-green-400'
          }`}>
            <div className="flex items-center gap-2">
              {limparImgsResult.error
                ? <AlertCircle size={12} className="shrink-0" />
                : limparImgsResult.resetados > 0
                  ? <AlertCircle size={12} className="shrink-0" />
                  : <CheckCircle2 size={12} className="shrink-0" />}
              <span>{limparImgsResult.error || limparImgsResult.info}</span>
            </div>
            {limparImgsResult.urlsSuspeitas?.length > 0 && (
              <p className="text-[10px] opacity-70 pl-4 break-all">
                URL removida: {limparImgsResult.urlsSuspeitas[0]}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      {/* ── Reconciliação: remove produtos fantasmas ── */}
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
        <p className="text-[11px] text-zinc-700">
          Use após um sync completo · Banco: ~2825 · Tiny: ~1603 (variações contam como SKUs separados)
        </p>
        {!loadingRecon && reconResult && (
          <div className={`flex flex-col gap-1 text-xs px-3 py-2 rounded-md ${reconResult.error ? 'bg-red-900/30 text-red-400' : reconResult.desativados > 0 ? 'bg-yellow-900/30 text-yellow-400' : 'bg-green-900/30 text-green-400'}`}>
            <div className="flex items-center gap-2">
              {reconResult.error ? <AlertCircle size={12} className="shrink-0" /> : reconResult.desativados > 0 ? <AlertCircle size={12} className="shrink-0" /> : <CheckCircle2 size={12} className="shrink-0" />}
              <span>
                {reconResult.error ||
                  (reconResult.desativados > 0
                    ? `${reconResult.desativados} fantasmas desativados de ${reconResult.totalAtivos} ativos`
                    : `Nenhum fantasma encontrado · ${reconResult.totalAtivos} produtos OK`
                  )
                }
              </span>
            </div>
            {!reconResult.error && reconResult.desativados > 0 && reconResult.exemplos?.length > 0 && (
              <p className="text-[10px] opacity-70 pl-4">
                Ex: {reconResult.exemplos.slice(0,3).map((e: any) => e.nome).join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
