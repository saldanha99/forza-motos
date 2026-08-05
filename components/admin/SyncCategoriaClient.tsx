'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, AlertCircle, Loader2, Play, StopCircle, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Botao, Card, CardHeader, EmptyState, TOM_FUNDO, TOM_TEXTO } from '@/components/admin/ui/primitives'
import { Select } from '@/components/admin/ui/form'

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
      <Card>
        <CardHeader
          titulo={
            <span className="inline-flex items-center gap-2">
              <Tag size={14} className="text-brand-accent" />
              Selecionar categoria
            </span>
          }
        />
        <div className="space-y-4 p-5">
          {loadingCats ? (
            <div className="flex items-center gap-2 text-sm text-brand-muted">
              <Loader2 size={14} className="animate-spin text-brand-accent" /> Carregando categorias…
            </div>
          ) : categorias.length === 0 ? (
            <EmptyState
              compacto
              icone={Tag}
              titulo="Nenhuma categoria encontrada"
              descricao="Categorias aparecem aqui assim que houver produtos com categoria cadastrada no Tiny."
            />
          ) : (
            <div className="space-y-3">
              <Select
                value={selected}
                onChange={e => { setSelected(e.target.value); setDone(false); setLog([]); setError('') }}
                disabled={running}
              >
                <option value="">— Escolha uma categoria —</option>
                {categorias.map(c => (
                  <option key={c.categoria} value={c.categoria}>
                    {c.categoria} ({c.total} produtos{c.semImagem > 0 ? ` · ${c.semImagem} sem foto` : ''})
                  </option>
                ))}
              </Select>

              {catSelecionada && (
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2 text-center">
                    <div className="text-lg font-bold text-brand-text">{catSelecionada.total}</div>
                    <div className="text-[10px] text-brand-muted">Total</div>
                  </div>
                  <div className={cn('flex-1 rounded-xl px-3 py-2 text-center', TOM_FUNDO.warning)}>
                    <div className={cn('text-lg font-bold', TOM_TEXTO.warning)}>{catSelecionada.semImagem}</div>
                    <div className="text-[10px] text-brand-muted">Sem imagem</div>
                  </div>
                  <div className={cn('flex-1 rounded-xl px-3 py-2 text-center', TOM_FUNDO.success)}>
                    <div className={cn('text-lg font-bold', TOM_TEXTO.success)}>{catSelecionada.total - catSelecionada.semImagem}</div>
                    <div className="text-[10px] text-brand-muted">Com imagem</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botão iniciar/parar */}
          <div className="pt-2">
            {!running ? (
              <Botao onClick={handleStart} disabled={!selected || loadingCats} tamanho="lg" className="w-full">
                <Play size={14} />
                Sincronizar categoria completa
              </Botao>
            ) : (
              <Botao variante="secundario" tamanho="lg" onClick={() => { cancelRef.current = true }} className="w-full">
                <StopCircle size={14} />
                Parar sync
              </Botao>
            )}
          </div>
        </div>
      </Card>

      {/* ── Progresso ── */}
      {(running || done || error) && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-brand-text">
              {running
                ? <><Loader2 size={13} className="animate-spin text-brand-accent" /> Processando…</>
                : done
                ? <><CheckCircle2 size={13} className="text-brand-success" /> Concluído</>
                : <><AlertCircle size={13} className="text-brand-danger" /> Erro</>
              }
            </p>
            <span className="font-mono text-sm text-brand-muted">
              {progress.processados}/{progress.total} · {pct}%
            </span>
          </div>

          {/* Barra de progresso */}
          <div className="h-2 w-full overflow-hidden rounded-full border border-brand-border bg-brand-surface-2">
            <div
              className={cn(
                'h-full rounded-full transition duration-500',
                done ? 'bg-brand-success' : error ? 'bg-brand-danger' : 'bg-brand-accent',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl border border-brand-border bg-brand-surface-2 p-2">
              <div className="font-bold text-brand-text">{progress.processados}</div>
              <div className="text-[10px] text-brand-muted">Processados</div>
            </div>
            <div className={cn('rounded-xl p-2', TOM_FUNDO.success)}>
              <div className={cn('font-bold', TOM_TEXTO.success)}>{progress.atualizados}</div>
              <div className="text-[10px] text-brand-muted">Atualizados</div>
            </div>
            <div className={cn('rounded-xl p-2', TOM_FUNDO.danger)}>
              <div className={cn('font-bold', TOM_TEXTO.danger)}>{progress.erros}</div>
              <div className="text-[10px] text-brand-muted">Erros</div>
            </div>
          </div>

          {/* Log */}
          <div
            ref={logRef}
            className="admin-scroll h-48 space-y-0.5 overflow-y-auto rounded-xl border border-brand-border bg-brand-surface-2 p-3 font-mono text-[11px]"
          >
            {log.map((line, i) => (
              <div key={i} className={
                line.startsWith('✅') ? 'text-brand-success' :
                line.startsWith('❌') ? 'text-brand-danger' :
                line.startsWith('⏹') ? 'text-brand-warning' :
                line.startsWith('✓') ? 'text-brand-info' :
                'text-brand-muted'
              }>
                {line}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
