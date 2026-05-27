'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'

interface Props {
  categorias: string[]
  marcas: string[]
  params: Record<string, string | undefined>
}

// ── Conteúdo dos filtros ──────────────────────────────────────────────────────
function FiltrosConteudo({
  categorias,
  marcas,
  params,
  onClose,
}: Props & { onClose?: () => void }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [busca,    setBusca]    = useState(params.busca    ?? '')
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
      {/* Busca */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--dim)' }} />
        <input
          type="text"
          placeholder="Nome ou modelo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && aplicar({ busca })}
          className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
          style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.40)', color: 'var(--ink)' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
          onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
        />
      </div>

      {/* Categorias */}
      {categorias.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--dim)' }}>Categoria</h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => aplicar({ categoria: '' })}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
              style={!params.categoria
                ? { background: 'var(--vermelho)', color: '#fff', boxShadow: '0 2px 12px rgba(212,43,43,0.35)' }
                : { background: 'rgba(0,0,0,0.06)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }}
            >Todos</button>
            {categorias.map((cat) => (
              <button
                key={cat}
                onClick={() => aplicar({ categoria: cat })}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 capitalize"
                style={params.categoria === cat
                  ? { background: 'var(--vermelho)', color: '#fff', boxShadow: '0 2px 12px rgba(212,43,43,0.35)' }
                  : { background: 'rgba(0,0,0,0.06)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }}
              >{cat}</button>
            ))}
          </div>
        </div>
      )}

      {/* Marcas */}
      {marcas.length > 0 && (
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--dim)' }}>Marca</h3>
          <div className="flex flex-wrap gap-1.5">
            {marcas.map((marca) => (
              <button
                key={marca}
                onClick={() => aplicar({ marca })}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200"
                style={params.marca === marca
                  ? { background: 'var(--vermelho)', color: '#fff', boxShadow: '0 2px 12px rgba(212,43,43,0.35)' }
                  : { background: 'rgba(0,0,0,0.06)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }}
              >{marca}</button>
            ))}
          </div>
        </div>
      )}

      {/* Faixa de Preço */}
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--dim)' }}>Faixa de Preço</h3>
        <div className="flex gap-2">
          <input
            type="number" placeholder="Mín" value={minPreco}
            onChange={(e) => setMinPreco(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.40)', color: 'var(--ink)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
          />
          <input
            type="number" placeholder="Máx" value={maxPreco}
            onChange={(e) => setMaxPreco(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.50)', border: '1px solid rgba(255,255,255,0.40)', color: 'var(--ink)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,43,43,0.60)' }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)' }}
          />
        </div>
        <button
          onClick={() => aplicar({ minPreco, maxPreco })}
          className="mt-2.5 w-full py-2 rounded-xl text-xs font-semibold transition-all duration-200"
          style={{ background: 'rgba(212,43,43,0.10)', color: 'var(--vermelho)', border: '1px solid rgba(212,43,43,0.20)' }}
        >Aplicar preço</button>
      </div>

      {/* Limpar */}
      {hasActiveFilters && (
        <button
          onClick={limpar}
          className="w-full py-2 rounded-xl text-xs font-medium transition-all duration-200"
          style={{ background: 'rgba(0,0,0,0.04)', color: 'var(--dim)', border: '1px solid rgba(0,0,0,0.08)' }}
        >Limpar filtros</button>
      )}
    </div>
  )
}

// ── Desktop: sidebar sticky ───────────────────────────────────────────────────
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

// ── Mobile: botão + bottom sheet ─────────────────────────────────────────────
//
// Padrão correto de drawer com animação no React/Next.js:
//   • "mounted"  → controla se o DOM existe (evita render SSR do drawer)
//   • "visible"  → controla o transform CSS (anima entrada/saída)
//   Assim o SSR nunca renderiza o drawer — não há hydration mismatch.
//
export function FiltrosMobile({ categorias, marcas, params }: Props) {
  const [mounted, setMounted]   = useState(false)   // DOM presente?
  const [visible, setVisible]   = useState(false)   // transform: translateY(0)?

  const activeCount = [
    params.busca,
    params.categoria,
    params.marca,
    params.minPreco || params.maxPreco,
  ].filter(Boolean).length

  const hasActive = activeCount > 0

  // ── Abre o drawer ──────────────────────────────────────────────────────────
  const openDrawer = useCallback(() => {
    setMounted(true)                                    // coloca no DOM
    // Pequeno delay para o browser aplicar o estado inicial antes de animar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))    // dispara animação de entrada
    })
    document.body.style.overflow = 'hidden'            // trava scroll
  }, [])

  // ── Fecha o drawer ─────────────────────────────────────────────────────────
  const closeDrawer = useCallback(() => {
    setVisible(false)                                  // anima saída
    document.body.style.overflow = ''                  // libera scroll
    setTimeout(() => setMounted(false), 320)           // remove do DOM após transição
  }, [])

  // Garante que o scroll seja liberado se o componente desmontar com drawer aberto
  useEffect(() => {
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      {/* ── Botão disparador ──────────────────────────────────────────────── */}
      <button
        onClick={openDrawer}
        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200"
        style={{
          background:    hasActive ? 'var(--vermelho)' : 'rgba(255,255,255,0.80)',
          color:         hasActive ? '#fff' : 'var(--ink)',
          border:        `1px solid ${hasActive ? 'transparent' : 'rgba(0,0,0,0.10)'}`,
          boxShadow:     '0 2px 8px rgba(0,0,0,0.08)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <SlidersHorizontal size={15} />
        Filtros
        {activeCount > 0 && (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: hasActive ? 'rgba(255,255,255,0.30)' : 'var(--vermelho)', color: '#fff' }}
          >
            {activeCount}
          </span>
        )}
      </button>

      {/* ── Portal: overlay + drawer (só no DOM quando aberto) ───────────── */}
      {mounted && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 transition-opacity duration-300"
            style={{
              background: 'rgba(0,0,0,0.45)',
              backdropFilter: 'blur(3px)',
              opacity: visible ? 1 : 0,
              pointerEvents: visible ? 'auto' : 'none',
            }}
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Bottom sheet */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros"
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col transition-transform duration-300 ease-out overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(20px)',
              height: '88vh',          /* altura fixa — overflow-hidden precisa de dimensão explícita */
              transform: visible ? 'translateY(0)' : 'translateY(100%)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.20)',
              willChange: 'transform', /* força compositing layer — evita vazamento */
            }}
          >
            {/* Handle de arraste */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-black/15" />
            </div>

            {/* Cabeçalho */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b shrink-0"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <span className="font-semibold text-base" style={{ color: 'var(--ink)' }}>
                Filtros
                {activeCount > 0 && (
                  <span className="ml-2 text-xs font-bold text-white bg-[var(--vermelho)] rounded-full px-2 py-0.5">
                    {activeCount}
                  </span>
                )}
              </span>
              <button
                onClick={closeDrawer}
                className="p-2 rounded-full transition-colors hover:bg-black/05 active:bg-black/10"
                aria-label="Fechar filtros"
              >
                <X size={18} style={{ color: 'var(--dim)' }} />
              </button>
            </div>

            {/* Conteúdo com scroll — ocupa o restante da altura */}
            <div
              className="flex-1 overflow-y-auto overscroll-contain px-5 py-5"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)' }}
            >
              <FiltrosConteudo
                categorias={categorias}
                marcas={marcas}
                params={params}
                onClose={closeDrawer}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}
