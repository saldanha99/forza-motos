'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, ShoppingBag, Package, Users, Calendar,
  FileText, LogOut, ImagePlus, RefreshCw, ExternalLink,
  BookOpen, Search, MessageCircle, Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/admin/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, exact: true },
  { href: '/admin/pedidos',       label: 'Pedidos',       icon: ShoppingBag },
  { href: '/admin/produtos',      label: 'Produtos',      icon: Package },
  { href: '/admin/fotos',         label: 'Fotos',         icon: ImagePlus },
  { href: '/admin/sync-categoria',label: 'Sync',          icon: RefreshCw },
  { href: '/admin/crm',           label: 'CRM WhatsApp',  icon: MessageCircle },
  { href: '/admin/clientes',      label: 'CRM Clientes',  icon: Users },
  { href: '/admin/agendamentos',  label: 'Agendamentos',  icon: Calendar },
  { href: '/admin/eventos',       label: 'Eventos',       icon: Ticket },
  { href: '/admin/blog',          label: 'Blog / CMS',    icon: FileText },
  { href: '/admin/glossario',     label: 'Glossário',     icon: BookOpen },
  { href: '/admin/seo',           label: 'SEO',           icon: Search },
]

// 5 items for mobile bottom bar — Dashboard / Pedidos / Produtos / Glossário / SEO
const BOTTOM_NAV = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[9], NAV_ITEMS[10]]

export function AdminSidebar({ user }: { user: any }) {
  const pathname = usePathname()

  function isActive(item: (typeof NAV_ITEMS)[0]) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href)
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 min-h-screen sticky top-0 admin-glass !bg-black/30 border-r border-brand-border/30 backdrop-blur-xl z-20">
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

        {/* User email */}
        {user?.email && (
          <div className="px-5 py-2 border-b border-brand-border/10">
            <p className="text-xs text-brand-muted truncate">{user.email}</p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5 p-3">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
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
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-brand-border/20 space-y-0.5 bg-black/10">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-muted hover:text-brand-text hover:bg-white/5 transition-all duration-150"
          >
            <ExternalLink size={15} />
            Ver loja
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-brand-muted hover:text-brand-text hover:bg-white/5 transition-all duration-150"
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
              {item.label.split('/')[0].trim()}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
