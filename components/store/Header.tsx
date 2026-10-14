'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogoSVG } from '@/components/store/LogoSVG'
import { useSession } from 'next-auth/react'
import { useCartStore } from '@/store/cart'
import { Search, User, ShoppingCart, Menu, X } from 'lucide-react'
import { ThemeToggle } from '@/components/store/ThemeToggle'
import { MARCAS_PNEUS, SUBMENUS } from '@/lib/menu-loja'
import { IconeCategoria, type IdCategoria } from '@/components/store/IconeCategoria'

const CATS = [
  { id: 'Pneus',       label: 'Pneus',       href: '/pneus' },
  { id: 'oleo',        label: 'Óleos',       href: '/oleos' },
  { id: 'freios',      label: 'Pastilhas',   href: '/pastilhas' },
  { id: 'suspensao',   label: 'Serviços',    href: '/servicos' },
  { id: 'filtros',     label: 'Filtros',     href: '/produtos?categoria=Filtros' },
  { id: 'correntes',   label: 'Kit Transmissão', href: '/produtos?categoria=Transmissão' },
  { id: 'acessorios',  label: 'Acessórios',  href: '/produtos?categoria=Acessórios' },
  { id: 'eventos',     label: 'Eventos',     href: '/calendario' },
]

/** Ícones da barra de categorias — o desenho mora em IconeCategoria. */
const ICONE_DA_ABA: Record<string, IdCategoria> = {
  Pneus: 'pneus',
  oleo: 'oleo',
  freios: 'freios',
  suspensao: 'servicos',
  filtros: 'filtros',
  correntes: 'transmissao',
  acessorios: 'capacetes',
  eventos: 'eventos',
}

function CatIcon({ id, active }: { id: string; active: boolean }) {
  return (
    <IconeCategoria
      id={ICONE_DA_ABA[id] ?? 'servicos'}
      cor={active ? '#d42b2b' : '#444'}
      opacidade={active ? 1 : 0.6}
    />
  )
}

/** Categoria de pneu no mega menu — vem do layout, que lê /admin/pneus-segmentos. */
export interface SegmentoMenu {
  nome: string
  slug: string
  produtos: number
}

export function Header({ segmentosPneu = [] }: { segmentosPneu?: SegmentoMenu[] }) {
  const router = useRouter()
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [hoverCat, setHoverCat] = useState<string | null>(null)
  const temSubmenu = (id: string) => id === 'Pneus' || Boolean(SUBMENUS[id])
  const itemCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantidade, 0))
  const abrirDrawer = useCartStore((s) => s.abrirDrawer)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) router.push(`/produtos?busca=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="sticky top-0 z-50" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>

      {/* ── TopBar ── */}
      <div className="bg-[#111] text-[#999] text-xs text-center py-[7px] px-5 flex items-center justify-center gap-1 flex-wrap font-inter">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
          <rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h5l3 5v5h-8V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
        <span>Entrega para todo Brasil</span>
        <span className="opacity-20 mx-2">|</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Envio em 24h</span>
        <span className="opacity-20 mx-2 hidden sm:inline">|</span>
        <span className="hidden sm:inline">
          Frete Grátis acima de <strong className="text-white ml-1">R$499</strong> <span className="opacity-60">(SP)</span>
        </span>
      </div>

      {/* ── MainHeader ──
          O logo é o elemento dominante da faixa, como na Barata Pneus e na
          Varella Motos: marca grande à esquerda, busca menor ao lado. */}
      <div className="bg-black px-4 md:px-10 py-3 md:py-5 flex items-center gap-4 md:gap-8">

        {/* Logo */}
        <Link href="/" className="shrink-0" aria-label="Forza Motos — página inicial">
          <LogoSVG dark variante="horizontal" height={58} className="hidden md:block" />
          <LogoSVG dark variante="horizontal" height={34} className="md:hidden" />
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 hidden sm:flex max-w-[520px] mx-auto rounded-[4px] overflow-hidden">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar peças, pneus, óleos, acessórios..."
            className="flex-1 border-none outline-none px-4 py-[11px] text-[13.5px] font-inter text-[#333] bg-white"
          />
          <button
            type="submit"
            className="bg-[#d42b2b] hover:bg-[#b82222] border-none px-[18px] py-[11px] cursor-pointer flex items-center transition-colors"
          >
            <Search size={18} className="text-white" />
          </button>
        </form>

        {/* Icons */}
        <div className="flex items-center gap-4 md:gap-6 ml-auto shrink-0">
          <Link
            href={session ? (session.user?.role === 'ADMIN' ? '/admin/dashboard' : '/minha-conta') : '/login'}
            className="text-white hidden md:flex flex-col items-center gap-0.5"
          >
            <User size={22} />
            <span className="text-[10px] font-inter opacity-65">Conta</span>
          </Link>

          <ThemeToggle />

          <Link
            href="/carrinho"
            onClick={(e) => {
              // Abre o drawer em vez de navegar (o drawer não existe em /carrinho e /checkout)
              const path = window.location.pathname
              if (!path.startsWith('/carrinho') && !path.startsWith('/checkout')) {
                e.preventDefault()
                abrirDrawer()
              }
            }}
            className="text-white flex flex-col items-center gap-0.5"
          >
            <div className="relative">
              <ShoppingCart size={22} />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#d42b2b] text-white text-[10px] font-bold w-[17px] h-[17px] rounded-full flex items-center justify-center font-inter">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-inter opacity-65 hidden md:block">Carrinho</span>
          </Link>

          <button
            className="md:hidden text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── CategoryBar (desktop) + mega menu ── */}
      <div
        className="bg-white border-b border-[#eee] hidden md:block relative"
        onMouseLeave={() => setHoverCat(null)}
      >
        <div className="flex justify-center px-10 min-w-max mx-auto overflow-x-auto scrollbar-none">
          {CATS.map((cat) => {
            const isActive = activeCat === cat.id || hoverCat === cat.id
            return (
              <Link
                key={cat.id}
                href={cat.href}
                onClick={() => { setActiveCat(cat.id); setHoverCat(null) }}
                onMouseEnter={() => setHoverCat(temSubmenu(cat.id) ? cat.id : null)}
                className="flex flex-col items-center gap-[5px] px-5 py-[10px] transition-colors"
                style={{ borderBottom: `2.5px solid ${isActive ? '#d42b2b' : 'transparent'}` }}
              >
                <CatIcon id={cat.id} active={isActive} />
                <span
                  className="text-[11.5px] font-inter whitespace-nowrap"
                  style={{ fontWeight: isActive ? 600 : 400, color: isActive ? '#d42b2b' : '#555' }}
                >
                  {cat.label}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Painel do mega menu */}
        {hoverCat && (
          <div
            className="absolute left-0 right-0 top-full bg-white border-b border-[#eee] z-50"
            style={{ boxShadow: '0 14px 28px rgba(0,0,0,0.12)' }}
          >
            <div className="max-w-[1080px] mx-auto px-8 py-7">
              {hoverCat === 'Pneus' ? (
                <>
                  {/* Categorias de uso — o caminho que a loja pediu primeiro */}
                  {segmentosPneu.length > 0 && (
                    <div className="mb-7 pb-6 border-b border-[#eee]">
                      <p className="font-barlow font-bold text-[14px] uppercase tracking-wider text-[#111] mb-3">
                        Categorias
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                        {segmentosPneu.map((seg) => (
                          <Link
                            key={seg.slug}
                            href={`/pneus/categoria/${seg.slug}`}
                            onClick={() => setHoverCat(null)}
                            className="group rounded-lg border border-[#e6e6e6] hover:border-[#d42b2b] px-3.5 py-3 transition-colors"
                          >
                            <span className="block font-barlow font-bold text-[14.5px] uppercase text-[#111] group-hover:text-[#d42b2b] transition-colors">
                              {seg.nome}
                            </span>
                            <span className="block text-[11.5px] font-inter text-[#999] mt-0.5">
                              {seg.produtos} {seg.produtos === 1 ? 'pneu' : 'pneus'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="grid grid-cols-4 gap-8">
                  {MARCAS_PNEUS.map((m) => (
                    <div key={m.marca}>
                      <Link
                        href={m.href}
                        onClick={() => setHoverCat(null)}
                        className="font-barlow font-bold text-[14px] uppercase tracking-wider text-[#111] hover:text-[#d42b2b] transition-colors"
                      >
                        {m.marca}
                      </Link>
                      <ul className="mt-3 space-y-2">
                        {m.modelos.map((mod) => (
                          <li key={mod.nome}>
                            <Link
                              href={`/produtos?busca=${encodeURIComponent(mod.busca)}`}
                              onClick={() => setHoverCat(null)}
                              className="text-[13px] font-inter text-[#666] hover:text-[#d42b2b] transition-colors"
                            >
                              {mod.nome}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link
                            href={m.href}
                            onClick={() => setHoverCat(null)}
                            className="text-[12px] font-inter font-semibold text-[#d42b2b] hover:underline"
                          >
                            Ver todos →
                          </Link>
                        </li>
                      </ul>
                    </div>
                  ))}
                  {/* Buscas especiais */}
                  <div>
                    <p className="font-barlow font-bold text-[14px] uppercase tracking-wider text-[#111]">
                      Encontre o pneu certo
                    </p>
                    <ul className="mt-3 space-y-2">
                      <li>
                        <Link href="/pneus#placa" onClick={() => setHoverCat(null)}
                          className="text-[13px] font-inter font-semibold text-[#d42b2b] hover:underline">
                          🔎 Pesquise pela sua placa
                        </Link>
                      </li>
                      <li>
                        <Link href="/pneus#medida" onClick={() => setHoverCat(null)}
                          className="text-[13px] font-inter text-[#666] hover:text-[#d42b2b] transition-colors">
                          Buscar pela medida
                        </Link>
                      </li>
                      <li>
                        <Link href="/produtos?categoria=Pneus" onClick={() => setHoverCat(null)}
                          className="text-[13px] font-inter text-[#666] hover:text-[#d42b2b] transition-colors">
                          Todos os pneus
                        </Link>
                      </li>
                      <li>
                        <Link href="/agendar" onClick={() => setHoverCat(null)}
                          className="text-[13px] font-inter text-[#666] hover:text-[#d42b2b] transition-colors">
                          Agendar troca — balanceamento incluso
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                </>
              ) : (
                <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${(SUBMENUS[hoverCat] ?? []).length}, minmax(0, 260px))`, justifyContent: 'center' }}>
                  {(SUBMENUS[hoverCat] ?? []).map((col) => (
                    <div key={col.titulo}>
                      <p className="font-barlow font-bold text-[14px] uppercase tracking-wider text-[#111]">
                        {col.titulo}
                      </p>
                      <ul className="mt-3 space-y-2">
                        {col.itens.map((item) => (
                          <li key={item.label}>
                            <Link
                              href={item.href}
                              onClick={() => setHoverCat(null)}
                              className={`text-[13px] font-inter transition-colors ${
                                item.destaque
                                  ? 'font-semibold text-[#d42b2b] hover:underline'
                                  : 'text-[#666] hover:text-[#d42b2b]'
                              }`}
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Mobile search ── */}
      <form onSubmit={handleSearch} className="sm:hidden flex bg-black border-t border-[#222] px-3 pb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar peças..."
          className="flex-1 border-none outline-none px-3 py-2.5 text-sm font-inter text-[#333] bg-white rounded-l-[4px]"
        />
        <button type="submit" className="bg-[#d42b2b] px-4 rounded-r-[4px]">
          <Search size={16} className="text-white" />
        </button>
      </form>

      {/* ── Mobile menu drawer ── */}
      {mobileOpen && (
        <div className="md:hidden bg-[#111] border-t border-[#222]">
          <div className="px-4 py-3 grid grid-cols-4 gap-2">
            {CATS.map((cat) => (
              <Link
                key={cat.id}
                href={cat.href}
                onClick={() => setMobileOpen(false)}
                className="flex flex-col items-center gap-1 py-3 text-[#aaa] hover:text-white"
              >
                <CatIcon id={cat.id} active={false} />
                <span className="text-[10px] font-inter text-center">{cat.label}</span>
              </Link>
            ))}
          </div>
          <div className="border-t border-[#222] px-4 py-2 flex flex-col gap-1">
            <Link href="/calendario" onClick={() => setMobileOpen(false)}
              className="py-2.5 px-3 text-sm text-[#d42b2b] hover:text-white font-inter font-semibold">
              Eventos / Calendário
            </Link>
            <Link href="/agendar" onClick={() => setMobileOpen(false)}
              className="py-2.5 px-3 text-sm text-[#aaa] hover:text-white font-inter">
              Agendar Serviço
            </Link>
            <Link href="/rastrear" onClick={() => setMobileOpen(false)}
              className="py-2.5 px-3 text-sm text-[#aaa] hover:text-white font-inter">
              Rastrear Pedido
            </Link>
            <Link
              href={session ? '/minha-conta' : '/login'}
              onClick={() => setMobileOpen(false)}
              className="py-2.5 px-3 text-sm text-[#aaa] hover:text-white font-inter"
            >
              {session ? 'Minha Conta' : 'Entrar / Criar conta'}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
