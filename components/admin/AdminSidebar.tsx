'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard, ShoppingBag, Package, Users, Calendar, FileText, LogOut, Menu, X, ImagePlus
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/produtos', label: 'Produtos', icon: Package },
  { href: '/admin/fotos', label: 'Fotos', icon: ImagePlus },
  { href: '/admin/clientes', label: 'CRM Clientes', icon: Users },
  { href: '/admin/agendamentos', label: 'Agendamentos', icon: Calendar },
  { href: '/admin/blog', label: 'Blog / CMS', icon: FileText },
]

export function AdminSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-zinc-800">
        <span className="font-rajdhani font-bold text-xl">
          <span className="text-white">FORZA</span>
          <span className="text-vermelho"> ADMIN</span>
        </span>
        <p className="text-xs text-zinc-600 mt-1 truncate">{user?.email}</p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname.startsWith(item.href)
                ? 'bg-vermelho/10 text-vermelho font-medium'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            )}
          >
            <item.icon size={17} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-zinc-800">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 text-xs text-zinc-600 hover:text-zinc-400"
        >
          Ver loja
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2 text-xs text-zinc-600 hover:text-red-400 transition-colors w-full"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-zinc-900 border border-zinc-700 p-2 rounded-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 bg-zinc-950 border-r border-zinc-800 min-h-screen sticky top-0">
        <SidebarContent />
      </aside>
    </>
  )
}
