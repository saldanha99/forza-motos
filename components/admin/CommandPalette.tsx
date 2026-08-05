'use client'

/**
 * Busca global do painel — abre com ⌘K / Ctrl+K (ou pelo botão da sidebar,
 * que dispara o evento 'open-command-palette').
 *
 * Navegação só por teclado: ↑ ↓ percorrem os resultados, Enter abre, Esc fecha.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoaderCircle, Package, Search, ShoppingBag, Users } from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { StatusPill } from './ui/primitives'

type Resultados = {
  produtos: { id: string; nome: string; sku: string; estoque: number; ativo: boolean }[]
  pedidos: { id: string; orderNumber: string; status: string; total: number }[]
  clientes: { id: string; nome: string | null; email: string }[]
}

const VAZIO: Resultados = { produtos: [], pedidos: [], clientes: [] }

type Linha = {
  chave: string
  grupo: string
  href: string
  icone: typeof Package
  principal: string
  secundario: React.ReactNode
}

export function CommandPalette() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Resultados>(VAZIO)
  const [carregando, setCarregando] = useState(false)
  const [selecionado, setSelecionado] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fechar = useCallback(() => {
    setAberto(false)
    setQ('')
    setRes(VAZIO)
    setSelecionado(0)
  }, [])

  // Uma lista achatada para o teclado percorrer, sem perder o agrupamento visual
  const linhas = useMemo<Linha[]>(
    () => [
      ...res.produtos.map((p) => ({
        chave: `prod-${p.id}`,
        grupo: 'Produtos',
        href: `/admin/produtos?q=${encodeURIComponent(p.sku)}`,
        icone: Package,
        principal: p.nome,
        secundario: (
          <span className="text-[11px] text-brand-dim">
            SKU {p.sku} · {p.ativo ? `${p.estoque} un` : 'inativo'}
          </span>
        ),
      })),
      ...res.pedidos.map((p) => ({
        chave: `ped-${p.id}`,
        grupo: 'Pedidos',
        href: `/admin/pedidos/${p.id}`,
        icone: ShoppingBag,
        principal: p.orderNumber,
        secundario: (
          <span className="flex items-center gap-2">
            <StatusPill status={p.status} ponto={false} />
            <span className="text-[11px] tabular-nums text-brand-dim">
              {formatPrice(p.total)}
            </span>
          </span>
        ),
      })),
      ...res.clientes.map((c) => ({
        chave: `cli-${c.id}`,
        grupo: 'Clientes',
        href: `/admin/clientes/${c.id}`,
        icone: Users,
        principal: c.nome ?? 'Sem nome',
        secundario: <span className="truncate text-[11px] text-brand-dim">{c.email}</span>,
      })),
    ],
    [res],
  )

  const ir = useCallback(
    (href: string) => {
      fechar()
      router.push(href)
    },
    [fechar, router],
  )

  // Atalhos globais
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberto((v) => !v)
      }
    }
    const onOpen = () => setAberto(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('open-command-palette', onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('open-command-palette', onOpen)
    }
  }, [])

  useEffect(() => {
    if (aberto) setTimeout(() => inputRef.current?.focus(), 50)
  }, [aberto])

  // Busca com debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    setSelecionado(0)
    if (q.trim().length < 2) {
      setRes(VAZIO)
      return
    }
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

  // Mantém o item selecionado visível ao navegar com as setas
  useEffect(() => {
    listaRef.current
      ?.querySelector<HTMLElement>('[data-selecionado="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [selecionado])

  if (!aberto) return null

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      fechar()
      return
    }
    if (!linhas.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelecionado((i) => (i + 1) % linhas.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelecionado((i) => (i - 1 + linhas.length) % linhas.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const alvo = linhas[selecionado]
      if (alvo) ir(alvo.href)
    }
  }

  const nenhum = q.trim().length >= 2 && !carregando && linhas.length === 0
  let grupoAnterior = ''

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-[color:var(--brand-overlay)] px-4 pt-[12vh] backdrop-blur-sm"
      onClick={fechar}
      role="dialog"
      aria-modal="true"
      aria-label="Busca global"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-pop"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-brand-hair px-4 py-3.5">
          {carregando ? (
            <LoaderCircle size={17} className="animate-spin text-brand-accent" />
          ) : (
            <Search size={17} className="text-brand-dim" />
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produto, pedido ou cliente…"
            aria-label="Buscar"
            className="flex-1 bg-transparent text-sm text-brand-text outline-none placeholder:text-brand-dim"
          />
          <kbd className="rounded-md border border-brand-border bg-brand-surface-2 px-1.5 py-0.5 text-[10px] text-brand-dim">
            Esc
          </kbd>
        </div>

        <div ref={listaRef} className="admin-scroll max-h-[50vh] overflow-y-auto">
          {q.trim().length < 2 && (
            <p className="px-4 py-6 text-center text-sm text-brand-muted">
              Digite ao menos 2 caracteres. Use ↑ ↓ para navegar e Enter para abrir.
            </p>
          )}

          {nenhum && (
            <p className="px-4 py-6 text-center text-sm text-brand-muted">
              Nada encontrado para “{q}”
            </p>
          )}

          {linhas.map((linha, i) => {
            const novoGrupo = linha.grupo !== grupoAnterior
            grupoAnterior = linha.grupo
            const ativo = i === selecionado
            const Icone = linha.icone
            return (
              <div key={linha.chave}>
                {novoGrupo && (
                  <p className="px-4 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dim">
                    {linha.grupo}
                  </p>
                )}
                <button
                  data-selecionado={ativo}
                  onMouseEnter={() => setSelecionado(i)}
                  onClick={() => ir(linha.href)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                    ativo ? 'bg-brand-accent-soft text-brand-text' : 'text-brand-muted',
                  )}
                >
                  <Icone size={15} className="shrink-0 text-brand-dim" />
                  <span className="min-w-0 flex-1 truncate">{linha.principal}</span>
                  <span className="shrink-0">{linha.secundario}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
