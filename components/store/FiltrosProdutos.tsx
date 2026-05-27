'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'

interface Props {
  categorias: string[]
  marcas: string[]
  params: Record<string, string | undefined>
}

// ── Conteúdo dos filtros (reutilizado no desktop e no drawer mobile) ──────────
function FiltrosConteudo({
  categorias,
  marcas,
  params,
  onClose,
}: Props & { onClose?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const [busca, setBusca] = useState(params.busca ?? '')
  const [minPreco, setMinPreco] = useState(params.minPreco ?? '')
  const [maxPreco, setMaxPreco] = useState(params.maxPreco ?? '')

  function aplicar(novosFiltros: Record<string, string>) {
    const merged = { ...params, ...novosFiltros, page: '1' }
    const q = new URLSearchParams()
    Object.entries(merged).forEach(([k, v]) => { if (v) q.set(k, v) })
    router.push(`${pathname}?${q.toString()}`)
    onClose?.()
  }

  function limpar() {
    setBusca('')
    setMinPreco('')
    setMaxPreco('')
    router.push(pathname)
    onClose?.()
  }

  const hasActiveFilters = !!(params.busca || params.categoria || params.marca || params.minPreco || params.maxPreco)

  return (
    <div className="space-y-5">
      {/* Search input */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--dim)' }}
        />
        <input
          type="text"
          placeholder="Nome ou modelo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aplicar({ busca })}
          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.50)',
            border: '1px solid rgba(255,255,255,0.40)',
            color: 'var(--ink)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
        />
      </div>

      {/* Categorias */}
      {categorias.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--dim)' }}>
            Categoria
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => aplicar({ categoria: '' })}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={
                !params.categoria
                  ? { background: 'var(--vermelho)', color: '#fff', boxShadow: '0 2px 12px rgba(212,43,43,0.35)' }
                  : { background: 'rgba(0,0,0,0.06)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }
              }
            >
              Todos
            </button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => aplicar({ categoria: cat })}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 capitalize"
                style={
                  params.categoria === cat
                    ? { background: 'var(--vermelho)', color: '#fff', boxShadow: '0 2px 12px rgba(212,43,43,0.35)' }
                    : { background: 'rgba(0,0,0,0.06)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }
                }
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Marcas */}
      {marcas.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--dim)' }}>
            Marca
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {marcas.map((marca) => (
              <button
                key={marca}
                onClick={() => aplicar({ marca })}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
                style={
                  params.marca === marca
                    ? { background: 'var(--vermelho)', color: '#fff', boxShadow: '0 2px 12px rgba(212,43,43,0.35)' }
                    : { background: 'rgba(0,0,0,0.06)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }
                }
              >
                {marca}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Faixa de Preço */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--dim)' }}>
          Faixa de Preço
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Mín"
            value={minPreco}
            onChange={(e) => setMinPreco(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.40)', color: 'var(--ink)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
          />
          <input
            type="number"
            placeholder="Máx"
            value={maxPreco}
            onChange={(e) => setMaxPreco(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.40)', color: 'var(--ink)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
          />
        </div>
        <button
          onClick={() => aplicar({ minPreco, maxPreco })}
          className="mt-2.5 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={{ background: 'rgba(212,43,43,0.10)', color: 'var(--vermelho)', border: '1px solid rgba(212,43,43,0.20)' }}
        >
          Aplicar preço
        </button>
      </div>

      {/* Limpar */}
      {hasActiveFilters && (
        <button
          onClick={limpar}
          className="w-full py-2 rounded-xl text-xs font-medium transition-all duration-200"
          style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}

// ── Versão desktop: sidebar sticky ───────────────────────────────────────────
export function FiltrosProdutos({ categorias, marcas, params }: Props) {
  return (
    <div
      className="sticky top-24 backdrop-blur-xl rounded-2xl shadow-lg p-5"
      style={{ background: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.50)' }}
    >
      <FiltrosConteudo categorias={categorias} marcas={marcas} params={params} />
    </div>
  )
}

// ── Versão mobile: botão + drawer bottom sheet ────────────────────────────────
export function FiltrosMobile({ categorias, marcas, params }: Props) {
  const [open, setOpen] = useState(false)
  const hasActiveFilters = !!(params.busca || params.categoria || params.marca || params.minPreco || params.maxPreco)

  const activeCount = [params.busca, params.categoria, params.marca, (params.minPreco || params.maxPreco)]
    .filter(Boolean).length

  return (
    <>
      {/* Botão disparador */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200"
        style={{
          background: hasActiveFilters ? 'var(--vermelho)' : 'rgba(255,255,255,0.80)',
          color: hasActiveFilters ? '#fff' : 'var(--ink)',
          border: `1px solid ${hasActiveFilters ? 'transparent' : 'rgba(0,0,0,0.10)'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <SlidersHorizontal size={15} />
        Filtros
        {activeCount > 0 && (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: hasActiveFilters ? 'rgba(255,255,255,0.30)' : 'var(--vermelho)', color: '#fff' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setOpen(false)}
          style={{ background: 'rgba(0,0,0,0.40)', backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-y-auto transition-transform duration-300"
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          maxHeight: '85dvh',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(0,0,0,0.15)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <span className="font-semibold text-base" style={{ color: 'var(--ink)' }}>Filtros</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.06)' }}
          >
            <X size={16} style={{ color: 'var(--dim)' }} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="px-5 py-5">
          <FiltrosConteudo
            categorias={categorias}
            marcas={marcas}
            params={params}
            onClose={() => setOpen(false)}
          />
        </div>
      </div>
    </>
  )
}
