'use client'

/**
 * Busca global do admin — abre com ⌘K / Ctrl+K (ou pelo botão do sidebar,
 * que dispara o evento 'open-command-palette').
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Package, ShoppingBag, Users, LoaderCircle } from 'lucide-react'

type Resultados = {
  produtos: { id: string; nome: string; sku: string; estoque: number; ativo: boolean }[]
  pedidos: { id: string; orderNumber: string; status: string; total: number }[]
  clientes: { id: string; nome: string | null; email: string }[]
}

const VAZIO: Resultados = { produtos: [], pedidos: [], clientes: [] }

export function CommandPalette() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Resultados>(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fechar = useCallback(() => {
    setAberto(false)
    setQ('')
    setRes(VAZIO)
  }, [])

  // Atalho ⌘K / Ctrl+K + evento do sidebar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberto((v) => !v)
      }
      if (e.key === 'Escape') fechar()
    }
    function onOpen() { setAberto(true) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpen)
    }
  }, [fechar])

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 50)
  }, [aberto])

  // Busca com debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setRes(VAZIO); return }
    debounceRef.current = setTimeout(async () => {
      setCarregando(true)
      try {
        const r = await fetch(`/api/admin/search?q=${encodeURIComponent(q.trim())}`)
        if (r.ok) setRes(await r.json())
      } finally {
        setCarregando(false)
      }
    }, 250)
    return () => clearTimeout(debounceRef.current)
  }, [q])

  function ir(href: string) {
    fechar()
    router.push(href)
  }

  if (!aberto) return null

  const nenhum =
    q.trim().length >= 2 && !carregando &&
    res.produtos.length === 0 && res.pedidos.length === 0 && res.clientes.length === 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/70 backdrop-blur-sm"
      onClick={fechar}
    >
      <div
        className="w-full max-w-xl admin-glass !bg-[#0d0d0d]/95 border border-brand-border/40 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-brand-border/20">
          {carregando ? (
            <LoaderCircle size={17} className="text-brand-accent animate-spin" />
          ) : (
            <Search size={17} className="text-brand-muted" />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produto, pedido ou cliente…"
            className="flex-1 bg-transparent outline-none text-brand-text placeholder:text-brand-muted/60 text-sm"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-brand-border/30 text-brand-muted">
            Esc
          </kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-[50vh] overflow-y-auto admin-scroll">
          {nenhum && (
            <p className="px-4 py-6 text-sm text-brand-muted text-center">
              Nada encontrado para “{q}”
            </p>
          )}

          {res.produtos.length > 0 && (
            <Grupo titulo="Produtos">
              {res.produtos.map((p) => (
                <Item key={p.id} onClick={() => ir(`/admin/produtos?q=${encodeURIComponent(p.sku)}`)}>
                  <Package size={15} className="text-brand-muted shrink-0" />
                  <span className="truncate flex-1">{p.nome}</span>
                  <span className="text-[11px] text-brand-muted shrink-0">
                    SKU {p.sku} · {p.ativo ? `${p.estoque} un` : 'inativo'}
                  </span>
                </Item>
              ))}
            </Grupo>
          )}

          {res.pedidos.length > 0 && (
            <Grupo titulo="Pedidos">
              {res.pedidos.map((p) => (
                <Item key={p.id} onClick={() => ir(`/admin/pedidos/${p.id}`)}>
                  <ShoppingBag size={15} className="text-brand-muted shrink-0" />
                  <span className="flex-1">{p.orderNumber}</span>
                  <span className="text-[11px] text-brand-muted">
                    {p.status} · R$ {p.total.toFixed(2)}
                  </span>
                </Item>
              ))}
            </Grupo>
          )}

          {res.clientes.length > 0 && (
            <Grupo titulo="Clientes">
              {res.clientes.map((c) => (
                <Item key={c.id} onClick={() => ir(`/admin/clientes/${c.id}`)}>
                  <Users size={15} className="text-brand-muted shrink-0" />
                  <span className="flex-1 truncate">{c.nome ?? 'Sem nome'}</span>
                  <span className="text-[11px] text-brand-muted truncate">{c.email}</span>
                </Item>
              ))}
            </Grupo>
          )}
        </div>
      </div>
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-brand-muted/60">
        {titulo}
      </p>
      {children}
    </div>
  )
}

function Item({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-brand-text hover:bg-brand-accent/10 transition-colors text-left"
    >
      {children}
    </button>
  )
}
