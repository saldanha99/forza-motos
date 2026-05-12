'use client'

import { useState } from 'react'
import { RefreshCw, Webhook, CheckCircle2, AlertCircle, Info } from 'lucide-react'

interface SyncResult {
  criados?: number
  atualizados?: number
  erros?: number
  total?: number
  error?: string
}

export function OlistSyncButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [showWebhookInfo, setShowWebhookInfo] = useState(false)

  async function handleSync() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/olist/sync', { method: 'POST' })
      const data = await res.json()
      setResult(data)
    } catch {
      setResult({ error: 'Erro de conexão com o servidor' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white text-sm">Sincronização OLIST / Tiny</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Importar produtos do catálogo Tiny ERP · Sync automático a cada 6h
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-vermelho hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Sincronizando…' : 'Sincronizar agora'}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-md ${
          result.error
            ? 'bg-red-900/30 text-red-400 border border-red-800/40'
            : 'bg-green-900/30 text-green-400 border border-green-800/40'
        }`}>
          {result.error
            ? <AlertCircle size={14} className="mt-0.5 shrink-0" />
            : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          }
          <span>
            {result.error
              ? `Erro: ${result.error}`
              : `${result.total} produto(s) processado(s) — ${result.criados} criado(s), ${result.atualizados} atualizado(s)${result.erros ? `, ${result.erros} erro(s)` : ''}`
            }
          </span>
        </div>
      )}

      {/* Divider */}
      <div className="border-t border-zinc-800" />

      {/* Webhook info */}
      <div>
        <button
          onClick={() => setShowWebhookInfo(!showWebhookInfo)}
          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <Webhook size={13} />
          <span>Sync automático via webhook</span>
          <span className="text-zinc-600">{showWebhookInfo ? '▲' : '▼'}</span>
        </button>

        {showWebhookInfo && (
          <div className="mt-3 bg-zinc-800/50 border border-zinc-700 rounded-md p-3 space-y-2">
            <div className="flex items-start gap-2 text-xs text-zinc-400">
              <Info size={13} className="mt-0.5 shrink-0 text-blue-400" />
              <p>
                Para sincronizar automaticamente quando um produto for criado ou alterado no Tiny,
                registre o webhook abaixo:
              </p>
            </div>
            <div className="space-y-1.5 text-xs">
              <div>
                <span className="text-zinc-500">URL do webhook:</span>
                <code className="ml-2 bg-zinc-900 px-2 py-0.5 rounded text-green-400 font-mono text-[11px]">
                  https://forza-motos-app.vercel.app/api/olist/webhook
                </code>
              </div>
              <div className="text-zinc-500">
                No Tiny: <span className="text-zinc-300">Menu → Configurações → API → Webhooks</span>
              </div>
              <div className="text-zinc-500">
                Eventos a ativar:{' '}
                <span className="text-zinc-300">Produto criado · Produto alterado</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
