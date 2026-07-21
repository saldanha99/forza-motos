'use client'

import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Bike, Plus, Trash2, Link2, X, Search, Check } from 'lucide-react'

interface Moto {
  id: string
  marca: string
  modelo: string
  anoDe: number
  anoAte: number | null
  slug: string
  produtos: number
}

interface ProdutoLite {
  id: string
  nome: string
  sku: string
  categoria: string
}

function faixa(anoDe: number, anoAte: number | null) {
  if (!anoAte) return `${anoDe} em diante`
  if (anoDe === anoAte) return `${anoDe}`
  return `${anoDe}–${anoAte}`
}

const FORM_VAZIO = { marca: '', modelo: '', anoDe: '', anoAte: '' }

export function MotosManager({ motosIniciais }: { motosIniciais: Moto[] }) {
  const [motos, setMotos] = useState(motosIniciais)
  const [form, setForm] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [vinculando, setVinculando] = useState<Moto | null>(null)

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    try {
      const res = await fetch('/api/admin/motos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar moto')
      setMotos((m) => [data, ...m])
      setForm(FORM_VAZIO)
      toast.success('Moto cadastrada!')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSalvando(false)
    }
  }

  async function remover(moto: Moto) {
    if (!confirm(`Excluir ${moto.marca} ${moto.modelo} (${faixa(moto.anoDe, moto.anoAte)})?`)) return
    const res = await fetch(`/api/admin/motos/${moto.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMotos((m) => m.filter((x) => x.id !== moto.id))
      toast.success('Moto excluída')
    } else toast.error('Erro ao excluir')
  }

  function onVinculado(motoId: string, total: number) {
    setMotos((m) => m.map((x) => (x.id === motoId ? { ...x, produtos: total } : x)))
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
      {/* Form criar moto */}
      <form onSubmit={criar} className="bg-brand-card border border-brand-line rounded-xl p-5 space-y-4 h-fit">
        <h2 className="font-barlow font-bold text-lg text-brand-text flex items-center gap-2">
          <Plus size={18} /> Nova moto
        </h2>
        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Marca *</label>
          <input value={form.marca} onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))} required
            placeholder="Honda, BMW, Yamaha…"
            className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Modelo *</label>
          <input value={form.modelo} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} required
            placeholder="CG 160, R 1200 GS…"
            className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Ano de *</label>
            <input type="number" value={form.anoDe} onChange={(e) => setForm((f) => ({ ...f, anoDe: e.target.value }))} required
              placeholder="2016"
              className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-brand-muted uppercase tracking-wider mb-1.5">Ano até</label>
            <input type="number" value={form.anoAte} onChange={(e) => setForm((f) => ({ ...f, anoAte: e.target.value }))}
              placeholder="em diante"
              className="w-full bg-brand-bg border border-brand-line rounded-lg px-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
          </div>
        </div>
        <p className="text-xs text-brand-muted">
          Cada faixa de ano é um registro (ex.: GS 1200 <strong>até 2012</strong>, <strong>2013–2018</strong>, <strong>2019+</strong>).
        </p>
        <button type="submit" disabled={salvando}
          className="w-full bg-[#d42b2b] hover:bg-red-700 disabled:opacity-60 text-white font-barlow font-bold uppercase text-sm tracking-wider py-2.5 rounded-lg transition-colors">
          {salvando ? 'Cadastrando…' : 'Cadastrar moto'}
        </button>
      </form>

      {/* Lista */}
      <div className="space-y-3">
        {motos.length === 0 && (
          <div className="bg-brand-card border border-brand-line rounded-xl p-8 text-center text-brand-muted text-sm">
            <Bike size={28} className="mx-auto mb-2 opacity-50" />
            Nenhuma moto cadastrada. Comece cadastrando ao lado.
          </div>
        )}
        {motos.map((m) => (
          <div key={m.id} className="bg-brand-card border border-brand-line rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-barlow font-bold text-brand-text">
                {m.marca} {m.modelo} <span className="text-brand-muted font-normal">· {faixa(m.anoDe, m.anoAte)}</span>
              </p>
              <p className="text-xs text-brand-muted mt-0.5">
                {m.produtos} produto{m.produtos === 1 ? '' : 's'} vinculado{m.produtos === 1 ? '' : 's'} · <span className="opacity-70">/moto/{m.slug}</span>
              </p>
            </div>
            <button onClick={() => setVinculando(m)}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg bg-[#d42b2b]/10 text-[#d42b2b] hover:bg-[#d42b2b] hover:text-white transition-colors">
              <Link2 size={14} /> Vincular produtos
            </button>
            <button onClick={() => remover(m)} title="Excluir"
              className="p-2 rounded-lg text-brand-muted hover:text-red-500 hover:bg-red-500/10 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {vinculando && (
        <VincularModal
          moto={vinculando}
          onClose={() => setVinculando(null)}
          onSaved={(total) => { onVinculado(vinculando.id, total); setVinculando(null) }}
        />
      )}
    </div>
  )
}

// ── Modal de vinculação ────────────────────────────────────────────────────
function VincularModal({ moto, onClose, onSaved }: {
  moto: Moto
  onClose: () => void
  onSaved: (total: number) => void
}) {
  const [selecionados, setSelecionados] = useState<Map<string, ProdutoLite>>(new Map())
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<ProdutoLite[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Carrega os já vinculados
  useEffect(() => {
    fetch(`/api/admin/motos/${moto.id}/produtos`)
      .then((r) => r.json())
      .then((lista: ProdutoLite[]) => {
        const map = new Map<string, ProdutoLite>()
        lista.forEach((p) => map.set(p.id, p))
        setSelecionados(map)
      })
      .catch(() => {})
  }, [moto.id])

  // Busca com debounce
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (busca.trim().length < 2) { setResultados([]); return }
    setCarregando(true)
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/produtos/buscar?q=${encodeURIComponent(busca.trim())}`)
        setResultados(await r.json())
      } finally {
        setCarregando(false)
      }
    }, 300)
    return () => { if (debounce.current) clearTimeout(debounce.current) }
  }, [busca])

  function toggle(p: ProdutoLite) {
    setSelecionados((prev) => {
      const next = new Map(prev)
      if (next.has(p.id)) next.delete(p.id)
      else next.set(p.id, p)
      return next
    })
  }

  async function salvar() {
    setSalvando(true)
    try {
      const res = await fetch(`/api/admin/motos/${moto.id}/produtos`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: Array.from(selecionados.keys()) }),
      })
      if (!res.ok) throw new Error()
      toast.success('Vínculos salvos!')
      onSaved(selecionados.size)
    } catch {
      toast.error('Erro ao salvar vínculos')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !salvando && onClose()} />
      <div className="relative z-10 w-full max-w-2xl bg-brand-card border border-brand-line rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-line">
          <div>
            <p className="font-barlow font-bold text-brand-text">{moto.marca} {moto.modelo} · {faixa(moto.anoDe, moto.anoAte)}</p>
            <p className="text-xs text-brand-muted">{selecionados.size} produto(s) selecionado(s)</p>
          </div>
          <button onClick={onClose} className="text-brand-muted hover:text-brand-text"><X size={20} /></button>
        </div>

        {/* Selecionados */}
        {selecionados.size > 0 && (
          <div className="px-6 py-3 border-b border-brand-line flex flex-wrap gap-2 max-h-28 overflow-y-auto">
            {Array.from(selecionados.values()).map((p) => (
              <button key={p.id} onClick={() => toggle(p)}
                className="inline-flex items-center gap-1.5 text-xs bg-[#d42b2b]/10 text-[#d42b2b] rounded-full pl-3 pr-2 py-1 hover:bg-[#d42b2b]/20">
                <span className="truncate max-w-[220px]">{p.nome}</span>
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        {/* Busca */}
        <div className="px-6 py-3 border-b border-brand-line">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
              placeholder="Buscar produto por nome, SKU ou categoria…"
              className="w-full bg-brand-bg border border-brand-line rounded-lg pl-9 pr-3 py-2 text-sm text-brand-text outline-none focus:border-[#d42b2b]" />
          </div>
        </div>

        {/* Resultados */}
        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-[120px]">
          {carregando && <p className="text-sm text-brand-muted py-4 text-center">Buscando…</p>}
          {!carregando && busca.trim().length >= 2 && resultados.length === 0 && (
            <p className="text-sm text-brand-muted py-4 text-center">Nenhum produto encontrado.</p>
          )}
          {resultados.map((p) => {
            const marcado = selecionados.has(p.id)
            return (
              <button key={p.id} onClick={() => toggle(p)}
                className="w-full flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-brand-bg text-left">
                <span className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${marcado ? 'bg-[#d42b2b] border-[#d42b2b] text-white' : 'border-brand-line'}`}>
                  {marcado && <Check size={13} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-brand-text truncate">{p.nome}</span>
                  <span className="block text-xs text-brand-muted">{p.sku} · {p.categoria}</span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-6 py-4 border-t border-brand-line flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-brand-muted hover:text-brand-text">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="px-5 py-2 rounded-lg bg-[#d42b2b] hover:bg-red-700 disabled:opacity-60 text-white font-bold text-sm uppercase tracking-wider">
            {salvando ? 'Salvando…' : 'Salvar vínculos'}
          </button>
        </div>
      </div>
    </div>
  )
}
