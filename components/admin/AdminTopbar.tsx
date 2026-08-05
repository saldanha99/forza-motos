'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Search } from 'lucide-react'
import { tituloDaRota } from '@/lib/admin/navegacao'
import { ThemeToggleAdmin } from './ui/AdminTheme'

/**
 * Barra superior do painel.
 *
 * O título e o subtítulo vêm do mapa de rotas — assim toda tela abre
 * dizendo em uma frase para que ela serve, sem depender de cada página
 * lembrar de escrever isso.
 */
export function AdminTopbar({ user }: { user: any }) {
  const pathname = usePathname()
  const { titulo, subtitulo } = tituloDaRota(pathname)

  const iniciais = (user?.nome ?? user?.email ?? '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join('')

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-brand-border bg-brand-bg/85 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-admin-drawer'))}
        aria-label="Abrir menu"
        className="-ml-1 rounded-lg p-2 text-brand-muted transition-colors hover:bg-brand-tint-2 hover:text-brand-text lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate font-barlow text-lg font-bold leading-tight text-brand-text">
          {titulo}
        </p>
        {subtitulo && (
          <p className="hidden truncate text-xs text-brand-muted sm:block">{subtitulo}</p>
        )}
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
        aria-label="Buscar"
        title="Buscar (⌘K)"
        className="rounded-lg p-2 text-brand-muted transition-colors hover:bg-brand-tint-2 hover:text-brand-text lg:hidden"
      >
        <Search size={18} />
      </button>

      <ThemeToggleAdmin />

      <Link
        href="/admin/configuracoes"
        title={user?.email}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-accent-soft text-[11px] font-bold text-brand-accent transition-colors hover:border-brand-accent"
      >
        {iniciais}
      </Link>
    </header>
  )
}
