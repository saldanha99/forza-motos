'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface SyncResult {
  criados: number
  atualizados: number
  erros: number
  total: number
  paginaAtual: number
  totalPaginas: number
  hasMore: boolean
  error?: string
}

export function OlistSyncButton() {
  const [loading, setLoading] = useState(false)
  const [progresso, setProgresso] = useState<SyncResult | null>(null)
  const [acumulado, setAcumulado] = useState({ criados: 0, atualizados: 0, erros: 0 })
  const [concluido, setConcluido] = useState(false)

  async function handleSync() {
    setLoading(true)
    setProgresso(null)
    setConcluido(false)
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
          setProgresso({ ...acum, total: 0, paginaAtual: pagina, totalPaginas: 1, hasMore: false, error: err.error || 'Erro no servidor' })
          break
        }

        const data: SyncResult = await res.json()

        acum = {
          criados: acum.criados + data.criados,
          atualizados: acum.atualizados + data.atualizados,
          erros: acum.erros + data.erros,
        }
        setAcumulado(acum)
        setProgresso({ ...data, ...acum })

        if (!data.hasMore) {
          setConcluido(true)
          break
        }

        pagina++
      } catch {
        setProgresso(p => p ? { ...p, error: 'Erro de conexão' } : null)
        break
      }
    }

    setLoading(false)
  }

  const pct = progresso && progresso.totalPaginas > 0
    ? Math.round((progresso.paginaAtual / progresso.totalPaginas) * 100)
    : 0

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-white text-sm">Sincronização OLIST / Tiny</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Importar produtos do catálogo Tiny ERP · Sync automático diário às 6h
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-vermelho hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
        >
          {loading
            ? <Loader2 size={14} className="animate-spin" />
            : <RefreshCw size={14} />
          }
          {loading ? 'Importando…' : 'Sincronizar agora'}
        </button>
      </div>

      {/* Barra de progresso */}
      {loading && progresso && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Lote {progresso.paginaAtual} de {progresso.totalPaginas}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5">
            <div
              className="bg-vermelho h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">
            {acumulado.criados} criados · {acumulado.atualizados} atualizados · {acumulado.erros} erros
          </p>
        </div>
      )}

      {/* Resultado final */}
      {!loading && progresso && (
        <div className={`flex items-start gap-2 text-xs px-3 py-2.5 rounded-md ${
          progresso.error
            ? 'bg-red-900/30 text-red-400 border border-red-800/40'
            : 'bg-green-900/30 text-green-400 border border-green-800/40'
        }`}>
          {progresso.error
            ? <AlertCircle size={14} className="mt-0.5 shrink-0" />
            : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          }
          <span>
            {progresso.error
              ? `Erro: ${progresso.error}`
              : `✅ ${progresso.total} produtos processados — ${acumulado.criados} criados, ${acumulado.atualizados} atualizados${acumulado.erros ? `, ${acumulado.erros} com erro` : ''}`
            }
          </span>
        </div>
      )}
    </div>
  )
}
