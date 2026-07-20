'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, ShoppingBag, Package, Users, Calendar,
  FileText, LogOut, ImagePlus, RefreshCw, ExternalLink,
  BookOpen, Search, MessageCircle, Ticket, Settings, Command, ListChecks,
  Megaphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string; icon: any; exact?: boolean }

const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [{ href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true }],
  },
  {
    title: 'Vendas',
    items: [
      { href: '/admin/pedidos',      label: 'Pedidos',       icon: ShoppingBag },
      { href: '/admin/agendamentos', label: 'Agendamentos',  icon: Calendar },
      { href: '/admin/eventos',      label: 'Eventos',       icon: Ticket },
    ],
  },
  {
    title: 'Catálogo',
    items: [
      { href: '/admin/produtos',      label: 'Produtos',      icon: Package },
      { href: '/admin/curadoria',     label: 'Curadoria',     icon: ListChecks },
      { href: '/admin/fotos',         label: 'Fotos',         icon: ImagePlus },
      { href: '/admin/sincronizacao', label: 'Sincronização', icon: RefreshCw },
    ],
  },
  {
    title: 'Clientes',
    items: [
      { href: '/admin/crm',      label: 'CRM WhatsApp', icon: MessageCircle },
      { href: '/admin/clientes', label: 'CRM Clientes', icon: Users },
    ],
  },
  {
    title: 'Conteúdo & SEO',
    items: [
      { href: '/admin/blog',      label: 'Blog / CMS', icon: FileText },
      { href: '/admin/glossario', label: 'Glossário',  icon: BookOpen },
      { href: '/admin/seo',       label: 'SEO',        icon: Search },
      { href: '/admin/marketing', label: 'Marketing',  icon: Megaphone },
    ],
  },
  {
    title: 'Sistema',
    items: [{ href: '/admin/configuracoes', label: 'Configurações', icon: Settings }],
  },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

// 5 itens da barra inferior mobile
const BOTTOM_NAV: NavItem[] = [
  ALL_ITEMS.find((i) => i.label === 'Dashboard')!,
  ALL_ITEMS.find((i) => i.label === 'Pedidos')!,
  ALL_ITEMS.find((i) => i.label === 'Produtos')!,
  ALL_ITEMS.find((i) => i.label === 'Sincronização')!,
  ALL_ITEMS.find((i) => i.label === 'SEO')!,
]

export function AdminSidebar({ user }: { user: any }) {
  const pathname = usePathname()

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  function abrirBusca() {
    window.dispatchEvent(new CustomEvent('open-command-palette'))
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-screen sticky top-0 max-h-screen admin-glass !bg-black/30 border-r border-brand-border/30 backdrop-blur-xl z-20">
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border/20">
          <div className="bg-white rounded-xl px-2 py-1">
            <Image
              src="/images/logo-forza.png"
              alt="Forza Motos"
              width={120}
              height={40}
              style={{ objectFit: 'contain', height: 36, width: 'auto' }}
              priority
            />
          </div>
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest bg-brand-accent/10 text-brand-accent border border-brand-accent/30 animate-pulse">
            Admin
          </span>
        </div>

        {/* Busca global */}
        <div className="px-3 pt-3">
          <button
            onClick={abrirBusca}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-brand-muted bg-white/[0.03] border border-brand-border/30 hover:border-brand-accent/40 hover:text-brand-text transition-all"
          >
            <Search size={14} />
            <span className="flex-1 text-left">Buscar…</span>
            <kbd className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 border border-brand-border/30">
              <Command size={9} />K
            </kbd>
          </button>
        </div>

        {/* Nav agrupada */}
        <nav className="flex-1 flex flex-col gap-0.5 p-3 overflow-y-auto admin-scroll">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.title ?? gi} className={gi > 0 ? 'mt-3' : ''}>
              {group.title && (
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-brand-muted/60">
                  {group.title}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = isActive(item)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'relative flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                        active
                          ? 'bg-gradient-to-r from-brand-accent to-brand-accent-hover text-white shadow-brand shadow-md'
                          : 'text-brand-muted hover:text-brand-text hover:bg-white/5',
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-white/60 rounded-full" />
                      )}
                      <item.icon size={17} className={active ? 'text-white' : ''} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-brand-border/20 space-y-0.5 bg-black/10">
          {user?.email && (
            <p className="px-3 pb-1 text-[11px] text-brand-muted/70 truncate">{user.email}</p>
          )}
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-brand-muted hover:text-brand-text hover:bg-white/5 transition-all duration-150"
          >
            <ExternalLink size={15} />
            Ver loja
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-brand-muted hover:text-brand-text hover:bg-white/5 transition-all duration-150"
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-brand-border/30 admin-glass !bg-black/50 px-1 py-2 backdrop-blur-xl rounded-t-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
        {BOTTOM_NAV.map((item) => {
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all duration-200 min-w-[52px]',
                active
                  ? 'text-brand-accent bg-brand-accent/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] border border-brand-accent/20'
                  : 'text-brand-muted hover:text-brand-text',
              )}
            >
              <item.icon size={20} />
              {item.label.split('/')[0].trim().slice(0, 8)}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
