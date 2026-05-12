'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2, Package, ShoppingBag } from 'lucide-react'

interface SyncResult {
  criados?: number
  atualizados?: number
  erros?: number
  total?: number
  paginaAtual?: number
  totalPaginas?: number
  hasMore?: boolean
  error?: string
}

interface PedidosResult {
  ok?: boolean
  totalTiny?: number
  atualizados?: number
  erros?: number
  error?: string
}

export function OlistSyncButton() {
  const [loadingProdutos, setLoadingProdutos] = useState(false)
  const [loadingPedidos, setLoadingPedidos] = useState(false)
  const [progresso, setProgresso] = useState<SyncResult | null>(null)
  const [acumulado, setAcumulado] = useState({ criados: 0, atualizados: 0, erros: 0 })
  const [resultadoPedidos, setResultadoPedidos] = useState<PedidosResult | null>(null)

  // ── Sync de produtos em lotes ──────────────────────────────────────────────
  async function handleSyncProdutos() {
    setLoadingProdutos(true)
    setProgresso(null)
    setAcumulado({ criados: 0, atualizados: 0, erros: 0 })

    let pagina = 1
    let acum = { criados: 0, atualizados: 0, erros: 0 }

    while (true) {
      try {
        const res = await fetch('/api/olist/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pagina }),
        })

        if (!res.ok) {
          const err = await res.json()
          setProgresso(p => ({ ...p, error: err.error || 'Erro no servidor' }))
          break
        }

        const data: SyncResult = await res.json()
        acum = {
          criados:    acum.criados    + (data.criados    ?? 0),
          atualizados: acum.atualizados + (data.atualizados ?? 0),
          erros:      acum.erros      + (data.erros      ?? 0),
        }
        setAcumulado(acum)
        setProgresso({ ...data, ...acum })

        if (!data.hasMore) break
        pagina++
      } catch {
        setProgresso(p => ({ ...(p ?? {}), error: 'Erro de conexão' }))
        break
      }
    }
    setLoadingProdutos(false)
  }

  // ── Sync de status de pedidos ──────────────────────────────────────────────
  async function handleSyncPedidos() {
    setLoadingPedidos(true)
    setResultadoPedidos(null)
    try {
      const res = await fetch('/api/olist/pedidos', { method: 'POST' })
      const data = await res.json()
      setResultadoPedidos(data)
    } catch {
      setResultadoPedidos({ error: 'Erro de conexão' })
    } finally {
      setLoadingPedidos(false)
    }
  }

  const pct = progresso?.totalPaginas
    ? Math.round(((progresso.paginaAtual ?? 1) / progresso.totalPaginas) * 100)
    : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">

      {/* ── Cabeçalho ── */}
      <div>
        <h3 className="font-semibold text-white text-sm">Sincronização OLIST / Tiny</h3>
        <p className="text-xs text-zinc-500 mt-0.5">Estoque, preços e pedidos · Cron diário às 6h</p>
      </div>

      {/* ── Sync Produtos ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <Package size={15} className="text-zinc-500" />
            <span>Produtos (estoque + preço + imagens)</span>
          </div>
          <button
            onClick={handleSyncProdutos}
            disabled={loadingProdutos}
            className="flex items-center gap-2 px-3 py-1.5 bg-vermelho hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
          >
            {loadingProdutos ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loadingProdutos ? 'Importando…' : 'Sincronizar'}
          </button>
        </div>

        {/* Barra de progresso */}
        {loadingProdutos && progresso && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Lote {progresso.paginaAtual} de {progresso.totalPaginas}</span>
              <span>{pct}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-1.5">
              <div className="bg-vermelho h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-zinc-500">
              {acumulado.criados} criados · {acumulado.atualizados} atualizados · {acumulado.erros} erros
            </p>
          </div>
        )}

        {/* Resultado */}
        {!loadingProdutos && progresso && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${
            progresso.error
              ? 'bg-red-900/30 text-red-400 border border-red-800/40'
              : 'bg-green-900/30 text-green-400 border border-green-800/40'
          }`}>
            {progresso.error ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
            <span>
              {progresso.error
                ? `Erro: ${progresso.error}`
                : `${progresso.total} produtos · ${acumulado.criados} criados · ${acumulado.atualizados} atualizados${acumulado.erros ? ` · ${acumulado.erros} erros` : ''}`
              }
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800" />

      {/* ── Sync Pedidos ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <ShoppingBag size={15} className="text-zinc-500" />
            <span>Status de pedidos do Tiny</span>
          </div>
          <button
            onClick={handleSyncPedidos}
            disabled={loadingPedidos}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-medium rounded-md transition-colors"
          >
            {loadingPedidos ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loadingPedidos ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>

        {!loadingPedidos && resultadoPedidos && (
          <div className={`flex items-start gap-2 text-xs px-3 py-2 rounded-md ${
            resultadoPedidos.error
              ? 'bg-red-900/30 text-red-400 border border-red-800/40'
              : 'bg-green-900/30 text-green-400 border border-green-800/40'
          }`}>
            {resultadoPedidos.error ? <AlertCircle size={13} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={13} className="mt-0.5 shrink-0" />}
            <span>
              {resultadoPedidos.error
                ? `Erro: ${resultadoPedidos.error}`
                : `${resultadoPedidos.totalTiny ?? 0} pedidos no Tiny · ${resultadoPedidos.atualizados ?? 0} status atualizados`
              }
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
