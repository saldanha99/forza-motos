'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, ChevronDown, CheckCircle2, AlertCircle, Loader2, Play, StopCircle, Tag } from 'lucide-react'

interface CatInfo {
  categoria: string
  total: number
  semImagem: number
}

export function SyncCategoriaClient() {
  const [categorias, setCategorias] = useState<CatInfo[]>([])
  const [loadingCats, setLoadingCats] = useState(true)
  const [selected, setSelected] = useState('')
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [progress, setProgress] = useState({ processados: 0, total: 0, atualizados: 0, erros: 0 })
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const cancelRef = useRef(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/admin/sync-categoria')
      .then(r => r.json())
      .then(d => setCategorias(d.categorias ?? []))
      .finally(() => setLoadingCats(false))
  }, [])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  async function handleStart() {
    if (!selected) return
    cancelRef.current = false
    setRunning(true)
    setDone(false)
    setError('')
    setLog([`⚡ Iniciando sync da categoria "${selected}"…`])
    setProgress({ processados: 0, total: 0, atualizados: 0, erros: 0 })

    let offset = 0
    let totalAcum = { atualizados: 0, erros: 0 }

    while (true) {
      if (cancelRef.current) {
        setLog(l => [...l, '⏹ Sync cancelado pelo usuário.'])
        break
      }

      try {
        const res = await fetch('/api/admin/sync-categoria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ categoria: selected, offset, lote: 8 }),
        })
        const data = await res.json()

        if (data.error) {
          setError(data.error)
          setLog(l => [...l, `❌ Erro: ${data.error}`])
          break
        }

        totalAcum.atualizados += data.atualizados ?? 0
        totalAcum.erros += data.erros ?? 0
        offset = data.offset

        setProgress({
          processados: offset,
          total: data.total,
          atualizados: totalAcum.atualizados,
          erros: totalAcum.erros,
        })

        // Adiciona detalhes ao log
        if (data.detalhes?.length) {
          setLog(l => [...l, ...data.detalhes])
        }

        if (data.done) {
          setLog(l => [...l, `✅ Concluído! ${totalAcum.atualizados} produtos atualizados, ${totalAcum.erros} erros.`])
          setDone(true)
          break
        }

        // Delay entre lotes para não sobrecarregar a API
        await new Promise(r => setTimeout(r, 600))
      } catch (e: any) {
        setError(e.message)
        setLog(l => [...l, `❌ Erro de conexão: ${e.message}`])
        break
      }
    }

    setRunning(false)
  }

  const pct = progress.total > 0
    ? Math.round((progress.processados / progress.total) * 100)
    : 0

  const catSelecionada = categorias.find(c => c.categoria === selected)

  return (
    <div className="space-y-6">

      {/* ── Seletor de categoria ── */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold text-sm flex items-center gap-2">
          <Tag size={14} className="text-blue-400" />
          Selecionar categoria
        </h2>

        {loadingCats ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <Loader2 size={14} className="animate-spin" /> Carregando categorias…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <select
                value={selected}
                onChange={e => { setSelected(e.target.value); setDone(false); setLog([]); setError('') }}
                disabled={running}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm appearance-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">— Escolha uma categoria —</option>
                {categorias.map(c => (
                  <option key={c.categoria} value={c.categoria}>
                    {c.categoria} ({c.total} produtos{c.semImagem > 0 ? ` · ${c.semImagem} sem foto` : ''})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>

            {catSelecionada && (
              <div className="flex gap-3">
                <div className="bg-zinc-800 rounded-lg px-3 py-2 text-center flex-1">
                  <div className="text-white font-bold text-lg">{catSelecionada.total}</div>
                  <div className="text-zinc-500 text-[10px]">Total</div>
                </div>
                <div className="bg-yellow-900/30 rounded-lg px-3 py-2 text-center flex-1">
                  <div className="text-yellow-400 font-bold text-lg">{catSelecionada.semImagem}</div>
                  <div className="text-zinc-500 text-[10px]">Sem imagem</div>
                </div>
                <div className="bg-green-900/30 rounded-lg px-3 py-2 text-center flex-1">
                  <div className="text-green-400 font-bold text-lg">{catSelecionada.total - catSelecionada.semImagem}</div>
                  <div className="text-zinc-500 text-[10px]">Com imagem</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Botão iniciar/parar */}
        <div className="pt-2">
          {!running ? (
            <button
              onClick={handleStart}
              disabled={!selected || loadingCats}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-xl transition-colors"
            >
              <Play size={14} />
              Sincronizar categoria completa
            </button>
          ) : (
            <button
              onClick={() => { cancelRef.current = true }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-xl transition-colors"
            >
              <StopCircle size={14} />
              Parar sync
            </button>
          )}
        </div>
      </div>

      {/* ── Progresso ── */}
      {(running || done || error) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              {running
                ? <><Loader2 size={13} className="animate-spin text-blue-400" /> Processando…</>
                : done
                ? <><CheckCircle2 size={13} className="text-green-400" /> Concluído</>
                : <><AlertCircle size={13} className="text-red-400" /> Erro</>
              }
            </h2>
            <span className="text-zinc-400 text-sm font-mono">
              {progress.processados}/{progress.total} · {pct}%
            </span>
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-zinc-800 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: done ? '#22c55e' : error ? '#ef4444' : '#3b82f6',
              }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-zinc-800 rounded-lg p-2">
              <div className="text-white font-bold">{progress.processados}</div>
              <div className="text-zinc-600 text-[10px]">Processados</div>
            </div>
            <div className="bg-green-900/30 rounded-lg p-2">
              <div className="text-green-400 font-bold">{progress.atualizados}</div>
              <div className="text-zinc-600 text-[10px]">Atualizados</div>
            </div>
            <div className="bg-red-900/30 rounded-lg p-2">
              <div className="text-red-400 font-bold">{progress.erros}</div>
              <div className="text-zinc-600 text-[10px]">Erros</div>
            </div>
          </div>

          {/* Log */}
          <div
            ref={logRef}
            className="bg-zinc-950 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-0.5"
          >
            {log.map((line, i) => (
              <div key={i} className={
                line.startsWith('✅') ? 'text-green-400' :
                line.startsWith('❌') ? 'text-red-400' :
                line.startsWith('⏹') ? 'text-yellow-400' :
                line.startsWith('✓') ? 'text-blue-300' :
                line.startsWith('○') ? 'text-zinc-500' :
                'text-zinc-400'
              }>
                {line}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
