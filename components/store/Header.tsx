'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useCartStore } from '@/store/cart'
import { Search, User, ShoppingCart, Menu, X } from 'lucide-react'

const CATS = [
  { id: 'Pneus',       label: 'Pneus',       href: '/pneus' },
  { id: 'oleo',        label: 'Óleos',       href: '/oleos' },
  { id: 'freios',      label: 'Pastilhas',   href: '/pastilhas' },
  { id: 'suspensao',   label: 'Serviços',    href: '/servicos' },
  { id: 'filtros',     label: 'Filtros',     href: '/produtos?categoria=Filtros' },
  { id: 'correntes',   label: 'Correntes',   href: '/produtos?categoria=Transmissão' },
  { id: 'capacetes',   label: 'Capacetes',   href: '/produtos?categoria=Capacetes' },
  { id: 'acessorios',  label: 'Acessórios',  href: '/produtos?categoria=Acessórios' },
]

function CatIcon({ id, active }: { id: string; active: boolean }) {
  const c = active ? '#d42b2b' : '#444'
  const op = active ? 1 : 0.6

  if (id === 'Pneus') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <circle cx="14" cy="14" r="11" stroke={c} strokeWidth="2.5"/>
      <circle cx="14" cy="14" r="4.5" fill={c}/>
      {[0,45,90,135,180,225,270,315].map((a, i) => {
        const r = a * Math.PI / 180
        return <circle key={i} cx={14 + 9 * Math.cos(r)} cy={14 + 9 * Math.sin(r)} r="1.6" fill={c}/>
      })}
    </svg>
  )

  if (id === 'oleo') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <path d="M10 4h8v3H10z" fill={c}/>
      <path d="M9 7h10v3l2 4v8a2 2 0 01-2 2H9a2 2 0 01-2-2v-8l2-4V7z" fill={c}/>
      <rect x="10" y="16" width="8" height="2" rx="1" fill="#fff" opacity="0.45"/>
    </svg>
  )

  if (id === 'filtros') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <ellipse cx="14" cy="8.5" rx="8" ry="3.5" stroke={c} strokeWidth="2.2"/>
      <path d="M6 8.5v11c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5v-11" stroke={c} strokeWidth="2.2"/>
    </svg>
  )

  if (id === 'freios') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <circle cx="14" cy="14" r="11" stroke={c} strokeWidth="2"/>
      <circle cx="14" cy="14" r="4.5" fill="none" stroke={c} strokeWidth="1.5"/>
      {[0,60,120,180,240,300].map((a, i) => {
        const r = a * Math.PI / 180
        return <circle key={i} cx={14 + 10.5 * Math.cos(r)} cy={14 + 10.5 * Math.sin(r)} r="1.8" fill={c}/>
      })}
    </svg>
  )

  if (id === 'suspensao') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <rect x="8" y="2" width="4" height="11" rx="2" stroke={c} strokeWidth="2"/>
      <rect x="16" y="2" width="4" height="11" rx="2" stroke={c} strokeWidth="2"/>
      <path d="M8 13C6 15 6 19 8 21 6 23 6 26 8 26" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none"/>
      <path d="M20 13C22 15 22 19 20 21 22 23 22 26 20 26" stroke={c} strokeWidth="2" strokeLinecap="round" fill="none"/>
    </svg>
  )

  if (id === 'correntes') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <rect x="1" y="9.5" width="9" height="9" rx="3" stroke={c} strokeWidth="2"/>
      <rect x="18" y="9.5" width="9" height="9" rx="3" stroke={c} strokeWidth="2"/>
      <line x1="10" y1="14" x2="18" y2="14" stroke={c} strokeWidth="2.5"/>
    </svg>
  )

  if (id === 'capacetes') return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <path d="M3.5 18c0-5.8 4.7-12 10.5-12S24.5 12.2 24.5 18H3.5z" stroke={c} strokeWidth="2" fill="none"/>
      <path d="M3.5 18h21" stroke={c} strokeWidth="2"/>
      <path d="M6.5 18c0 2.5 2 4.5 7.5 4.5s7.5-2 7.5-4.5" stroke={c} strokeWidth="1.8" fill="none"/>
      <rect x="6" y="12.5" width="16" height="5.5" rx="1.5" fill={c} opacity="0.35"/>
    </svg>
  )

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: op }}>
      <path d="M7 7l3.5 3.5m0 0l11 11M10.5 10.5L9.5 5.5l5 1.5M21.5 21.5l4 4-2.5 2.5-4-4" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function Header() {
  const router = useRouter()
  const { data: session } = useSession()
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const itemCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantidade, 0))

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
          Frete Grátis acima de <strong className="text-white ml-1">R$299</strong>
        </span>
      </div>

      {/* ── MainHeader ── */}
      <div className="bg-black px-4 md:px-12 py-3 flex items-center gap-4 md:gap-6">

        {/* Logo */}
        <Link href="/" className="shrink-0">
          <div className="bg-white rounded-[5px] px-2 py-[5px] flex items-center justify-center" style={{ minWidth: 52 }}>
            <Image
              src="/logo.png"
              alt="Forza Motos"
              width={120}
              height={44}
              className="h-[36px] md:h-[42px] w-auto object-contain"
              priority
            />
          </div>
        </Link>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 hidden sm:flex max-w-[620px] mx-auto rounded-[4px] overflow-hidden">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar peças, pneus, óleos, capacetes..."
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

          <Link href="/carrinho" className="text-white flex flex-col items-center gap-0.5">
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

      {/* ── CategoryBar (desktop) ── */}
      <div className="bg-white border-b border-[#eee] overflow-x-auto scrollbar-none hidden md:block">
        <div className="flex justify-center px-10 min-w-max mx-auto">
          {CATS.map((cat) => {
            const isActive = activeCat === cat.id
            return (
              <Link
                key={cat.id}
                href={cat.href}
                onClick={() => setActiveCat(isActive ? null : cat.id)}
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
