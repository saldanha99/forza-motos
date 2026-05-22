'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, CheckCircle2, AlertCircle, Loader2, Play, StopCircle, Tag } from 'lucide-react'

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
    const totalAcum = { atualizados: 0, erros: 0 }

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
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-4 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
        <h2 className="text-brand-text font-semibold text-sm flex items-center gap-2">
          <Tag size={14} className="text-brand-accent" />
          Selecionar categoria
        </h2>

        {loadingCats ? (
          <div className="flex items-center gap-2 text-brand-muted text-sm">
            <Loader2 size={14} className="animate-spin text-brand-accent" /> Carregando categorias…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <select
                value={selected}
                onChange={e => { setSelected(e.target.value); setDone(false); setLog([]); setError('') }}
                disabled={running}
                className="w-full bg-brand-surface-2 border border-brand-border text-brand-text rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:border-brand-accent/50 disabled:opacity-50 transition-all duration-200"
              >
                <option value="" className="bg-brand-bg text-brand-text">— Escolha uma categoria —</option>
                {categorias.map(c => (
                  <option key={c.categoria} value={c.categoria} className="bg-brand-bg text-brand-text">
                    {c.categoria} ({c.total} produtos{c.semImagem > 0 ? ` · ${c.semImagem} sem foto` : ''})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted pointer-events-none" />
            </div>

            {catSelecionada && (
              <div className="flex gap-3">
                <div className="bg-brand-surface-2 border border-brand-border/30 rounded-xl px-3 py-2 text-center flex-1">
                  <div className="text-brand-text font-bold text-lg">{catSelecionada.total}</div>
                  <div className="text-brand-muted text-[10px]">Total</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl px-3 py-2 text-center flex-1">
                  <div className="text-amber-400 font-bold text-lg">{catSelecionada.semImagem}</div>
                  <div className="text-brand-muted text-[10px]">Sem imagem</div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl px-3 py-2 text-center flex-1">
                  <div className="text-emerald-400 font-bold text-lg">{catSelecionada.total - catSelecionada.semImagem}</div>
                  <div className="text-brand-muted text-[10px]">Com imagem</div>
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
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 disabled:opacity-40 text-brand-text font-semibold rounded-xl transition-all duration-200 shadow-md shadow-brand-accent/20"
            >
              <Play size={14} />
              Sincronizar categoria completa
            </button>
          ) : (
            <button
              onClick={() => { cancelRef.current = true }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-surface-2 hover:bg-brand-accent/20 border border-brand-border/30 text-brand-text font-semibold rounded-xl transition-all duration-200"
            >
              <StopCircle size={14} />
              Parar sync
            </button>
          )}
        </div>
      </div>

      {/* ── Progresso ── */}
      {(running || done || error) && (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-brand-text font-semibold text-sm flex items-center gap-2">
              {running
                ? <><Loader2 size={13} className="animate-spin text-brand-accent" /> Processando…</>
                : done
                ? <><CheckCircle2 size={13} className="text-emerald-400" /> Concluído</>
                : <><AlertCircle size={13} className="text-rose-400" /> Erro</>
              }
            </h2>
            <span className="text-brand-muted text-sm font-mono">
              {progress.processados}/{progress.total} · {pct}%
            </span>
          </div>

          {/* Barra de progresso */}
          <div className="w-full bg-brand-surface-2 border border-brand-border/20 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: done ? '#10b981' : error ? '#f43f5e' : '#eb2a24',
              }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-brand-surface-2 border border-brand-border/30 rounded-xl p-2">
              <div className="text-brand-text font-bold">{progress.processados}</div>
              <div className="text-brand-muted text-[10px]">Processados</div>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-2">
              <div className="text-emerald-400 font-bold">{progress.atualizados}</div>
              <div className="text-brand-muted text-[10px]">Atualizados</div>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-2">
              <div className="text-rose-400 font-bold">{progress.erros}</div>
              <div className="text-brand-muted text-[10px]">Erros</div>
            </div>
          </div>

          {/* Log */}
          <div
            ref={logRef}
            className="bg-brand-bg/50 border border-brand-border/20 rounded-xl p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-0.5"
          >
            {log.map((line, i) => (
              <div key={i} className={
                line.startsWith('✅') ? 'text-emerald-400' :
                line.startsWith('❌') ? 'text-rose-400' :
                line.startsWith('⏹') ? 'text-amber-400' :
                line.startsWith('✓') ? 'text-sky-300' :
                line.startsWith('○') ? 'text-brand-muted' :
                'text-brand-muted'
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
