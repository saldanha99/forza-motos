'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { ShoppingCart, User, Menu, X, Phone } from 'lucide-react'
import { useState } from 'react'
import { useCartStore } from '@/store/cart'

export function Header() {
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const itemCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantidade, 0))

  const navLinks = [
    { href: '/produtos', label: 'Produtos' },
    { href: '/agendar', label: 'Agendar Serviço' },
    { href: '/rastrear', label: 'Rastrear Pedido' },
    { href: '/blog', label: 'Blog' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="font-rajdhani font-bold text-2xl tracking-wider">
              <span className="text-white">FORZA</span>
              <span className="text-vermelho"> MOTOS</span>
            </span>
          </Link>

          {/* Nav Desktop */}
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-zinc-400 hover:text-white transition-colors font-medium"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <a
              href="tel:+551932540547"
              className="hidden md:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <Phone size={13} />
              (19) 3254-0547
            </a>

            <Link
              href="/carrinho"
              className="relative p-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-vermelho text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>

            {session ? (
              <div className="flex items-center gap-2">
                <Link
                  href={session.user.role === 'ADMIN' ? '/admin/dashboard' : '/minha-conta'}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <User size={20} />
                </Link>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden md:inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <User size={16} />
                Entrar
              </Link>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-zinc-400 hover:text-white"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-900">
          <div className="px-4 py-3 flex flex-col gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-zinc-300 hover:text-white font-medium"
              >
                {l.label}
              </Link>
            ))}
            {session ? (
              <>
                <Link href="/minha-conta" onClick={() => setMobileOpen(false)} className="py-2 text-zinc-300">
                  Minha Conta
                </Link>
                <button onClick={() => signOut()} className="py-2 text-left text-zinc-500">
                  Sair
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)} className="py-2 text-zinc-300">
                Entrar / Criar conta
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
