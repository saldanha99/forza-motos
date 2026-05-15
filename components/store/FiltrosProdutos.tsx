'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState } from 'react'
import { Search } from 'lucide-react'

interface Props {
  categorias: string[]
  marcas: string[]
  params: Record<string, string | undefined>
}

export function FiltrosProdutos({ categorias, marcas, params }: Props) {
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
  }

  function limpar() {
    setBusca('')
    setMinPreco('')
    setMaxPreco('')
    router.push(pathname)
  }

  const hasActiveFilters = !!(params.busca || params.categoria || params.marca || params.minPreco || params.maxPreco)

  return (
    <div
      className="sticky top-24 backdrop-blur-xl rounded-2xl shadow-lg space-y-5 p-5"
      style={{
        background: 'rgba(255,255,255,0.70)',
        border: '1px solid rgba(255,255,255,0.50)',
      }}
    >
      <style>{`
        [data-theme='dark'] .filtros-glass {
          background: rgba(24,24,27,0.75) !important;
          border-color: rgba(255,255,255,0.07) !important;
        }
        [data-theme='dark'] .filtros-input {
          background: rgba(255,255,255,0.07) !important;
          border-color: rgba(255,255,255,0.10) !important;
          color: var(--ink) !important;
        }
        [data-theme='dark'] .filtros-input::placeholder {
          color: var(--dim) !important;
        }
        [data-theme='dark'] .filtros-section-title {
          color: var(--dim) !important;
        }
      `}</style>

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
          className="filtros-input w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none transition-all duration-200 backdrop-blur-sm"
          style={{
            background: 'rgba(255,255,255,0.50)',
            border: '1px solid rgba(255,255,255,0.40)',
            color: 'var(--ink)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)'
          }}
        />
      </div>

      {/* Categorias */}
      {categorias.length > 0 && (
        <div>
          <h3
            className="filtros-section-title text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--dim)' }}
          >
            Categoria
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => aplicar({ categoria: '' })}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={
                !params.categoria
                  ? {
                      background: 'var(--vermelho)',
                      color: '#fff',
                      boxShadow: '0 2px 12px rgba(212,43,43,0.35)',
                    }
                  : {
                      background: 'rgba(0,0,0,0.06)',
                      color: 'var(--dim)',
                      border: '1px solid rgba(0,0,0,0.08)',
                    }
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
                    ? {
                        background: 'var(--vermelho)',
                        color: '#fff',
                        boxShadow: '0 2px 12px rgba(212,43,43,0.35)',
                      }
                    : {
                        background: 'rgba(0,0,0,0.06)',
                        color: 'var(--dim)',
                        border: '1px solid rgba(0,0,0,0.08)',
                      }
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
          <h3
            className="filtros-section-title text-[10px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: 'var(--dim)' }}
          >
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
                    ? {
                        background: 'var(--vermelho)',
                        color: '#fff',
                        boxShadow: '0 2px 12px rgba(212,43,43,0.35)',
                      }
                    : {
                        background: 'rgba(0,0,0,0.06)',
                        color: 'var(--dim)',
                        border: '1px solid rgba(0,0,0,0.08)',
                      }
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
        <h3
          className="filtros-section-title text-[10px] font-semibold uppercase tracking-widest mb-3"
          style={{ color: 'var(--dim)' }}
        >
          Faixa de Preço
        </h3>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Mín"
            value={minPreco}
            onChange={(e) => setMinPreco(e.target.value)}
            className="filtros-input w-full px-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.50)',
              border: '1px solid rgba(255,255,255,0.40)',
              color: 'var(--ink)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
          />
          <input
            type="number"
            placeholder="Máx"
            value={maxPreco}
            onChange={(e) => setMaxPreco(e.target.value)}
            className="filtros-input w-full px-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.50)',
              border: '1px solid rgba(255,255,255,0.40)',
              color: 'var(--ink)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
          />
        </div>
        <button
          onClick={() => aplicar({ minPreco, maxPreco })}
          className="mt-2.5 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={{
            background: 'rgba(212,43,43,0.10)',
            color: 'var(--vermelho)',
            border: '1px solid rgba(212,43,43,0.20)',
          }}
        >
          Aplicar preço
        </button>
      </div>

      {/* Limpar */}
      {hasActiveFilters && (
        <button
          onClick={limpar}
          className="w-full py-2 rounded-xl text-xs font-medium transition-all duration-200"
          style={{
            background: 'rgba(0,0,0,0.04)',
            color: 'var(--dim)',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          Limpar filtros
        </button>
      )}
    </div>
  )
}
