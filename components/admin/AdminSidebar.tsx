'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'
import {
  Command, ExternalLink, LogOut, PanelLeftClose, PanelLeftOpen, Search, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  GRUPOS_NAV, NAV_MOBILE, type ChaveBadge, type ItemNav,
} from '@/lib/admin/navegacao'

export type BadgesNav = Partial<Record<ChaveBadge, number>>

const CHAVE_RECOLHIDA = 'forza-admin-sidebar-recolhida'

function useAtivo() {
  const pathname = usePathname()
  return (item: ItemNav) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)
}

/* ═══════════════════════════════════════════════════════════════════
   Item de navegação
   ═══════════════════════════════════════════════════════════════════ */

function ItemLink({
  item, ativo, recolhida, badge, onNavegar,
}: {
  item: ItemNav
  ativo: boolean
  recolhida: boolean
  badge?: number
  onNavegar?: () => void
}) {
  const Icone = item.icon
  const mostrarBadge = !!badge && badge > 0

  return (
    <Link
      href={item.href}
      onClick={onNavegar}
      title={recolhida ? item.label : undefined}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
        recolhida && 'justify-center px-0',
        ativo
          ? 'bg-brand-accent text-brand-on-accent shadow-cta'
          : 'text-brand-muted hover:bg-brand-tint-2 hover:text-brand-text',
      )}
    >
      <span className="relative shrink-0">
        <Icone size={17} />
        {/* Recolhida: o badge vira um ponto sobre o ícone */}
        {recolhida && mostrarBadge && (
          <span
            className={cn(
              'absolute -right-1.5 -top-1 h-2 w-2 rounded-full ring-2 ring-brand-sidebar',
              item.urgente ? 'bg-brand-danger' : 'bg-brand-accent',
            )}
          />
        )}
      </span>

      {!recolhida && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {mostrarBadge && (
            <span
              className={cn(
                'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                ativo
                  ? 'bg-brand-on-accent-soft text-brand-on-accent'
                  : item.urgente
                    ? 'bg-brand-danger-soft text-brand-danger'
                    : 'bg-brand-tint-2 text-brand-muted',
              )}
            >
              {badge! > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </Link>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Conteúdo compartilhado entre desktop e gaveta mobile
   ═══════════════════════════════════════════════════════════════════ */

function Conteudo({
  user, badges, recolhida, onNavegar,
}: {
  user: any
  badges: BadgesNav
  recolhida: boolean
  onNavegar?: () => void
}) {
  const ehAtivo = useAtivo()

  function abrirBusca() {
    onNavegar?.()
    window.dispatchEvent(new CustomEvent('open-command-palette'))
  }

  return (
    <>
      {/* Busca global */}
      <div className={cn('pt-3', recolhida ? 'px-2' : 'px-3')}>
        <button
          onClick={abrirBusca}
          title="Buscar (⌘K)"
          className={cn(
            'flex w-full items-center gap-2 rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2',
            'text-sm text-brand-dim transition-all hover:border-brand-accent hover:text-brand-text',
            recolhida && 'justify-center px-0',
          )}
        >
          <Search size={14} className="shrink-0" />
          {!recolhida && (
            <>
              <span className="flex-1 text-left">Buscar…</span>
              <kbd className="flex items-center gap-0.5 rounded-md border border-brand-border bg-brand-elevated px-1.5 py-0.5 text-[10px]">
                <Command size={9} />K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Navegação agrupada */}
      <nav className={cn('admin-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto py-3', recolhida ? 'px-2' : 'px-3')}>
        {GRUPOS_NAV.map((grupo, gi) => (
          <div key={grupo.titulo ?? gi} className={gi > 0 ? 'mt-3' : ''}>
            {grupo.titulo && !recolhida && (
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-dim">
                {grupo.titulo}
              </p>
            )}
            {grupo.titulo && recolhida && gi > 0 && (
              <div className="mx-2 mb-2 border-t border-brand-hair" />
            )}
            <div className="flex flex-col gap-0.5">
              {grupo.itens.map((item) => (
                <ItemLink
                  key={item.href}
                  item={item}
                  ativo={ehAtivo(item)}
                  recolhida={recolhida}
                  badge={item.badge ? badges[item.badge] : undefined}
                  onNavegar={onNavegar}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Rodapé */}
      <div className={cn('space-y-0.5 border-t border-brand-hair py-3', recolhida ? 'px-2' : 'px-3')}>
        {!recolhida && user?.email && (
          <p className="truncate px-3 pb-1 text-[11px] text-brand-dim">{user.email}</p>
        )}
        <Link
          href="/"
          title={recolhida ? 'Ver loja' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-brand-muted transition-all hover:bg-brand-tint-2 hover:text-brand-text',
            recolhida && 'justify-center px-0',
          )}
        >
          <ExternalLink size={15} className="shrink-0" />
          {!recolhida && 'Ver loja'}
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={recolhida ? 'Sair' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-brand-muted transition-all hover:bg-brand-danger-soft hover:text-brand-danger',
            recolhida && 'justify-center px-0',
          )}
        >
          <LogOut size={15} className="shrink-0" />
          {!recolhida && 'Sair'}
        </button>
      </div>
    </>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Sidebar
   ═══════════════════════════════════════════════════════════════════ */

export function AdminSidebar({ user, badges = {} }: { user: any; badges?: BadgesNav }) {
  const [recolhida, setRecolhida] = useState(false)
  const [gaveta, setGaveta] = useState(false)
  const pathname = usePathname()
  const ehAtivo = useAtivo()

  // Preferência de largura é local do operador — fica no navegador dele
  useEffect(() => {
    setRecolhida(localStorage.getItem(CHAVE_RECOLHIDA) === '1')
  }, [])

  function alternarRecolhida() {
    setRecolhida((r) => {
      localStorage.setItem(CHAVE_RECOLHIDA, r ? '0' : '1')
      return !r
    })
  }

  // A gaveta do mobile fecha sozinha ao trocar de rota
  useEffect(() => setGaveta(false), [pathname])

  // O topbar dispara este evento pelo botão de menu
  useEffect(() => {
    const abrir = () => setGaveta(true)
    window.addEventListener('open-admin-drawer', abrir)
    return () => window.removeEventListener('open-admin-drawer', abrir)
  }, [])

  return (
    <>
      {/* ── Desktop ── */}
      <aside
        className={cn(
          'sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-brand-border bg-brand-sidebar lg:flex',
          'transition-[width] duration-300 ease-out',
          recolhida ? 'w-[74px]' : 'w-64',
        )}
      >
        <div className={cn('flex items-center gap-2 border-b border-brand-hair px-3 py-3', recolhida && 'justify-center px-2')}>
          {!recolhida && (
            <Link href="/admin/dashboard" className="rounded-xl bg-white px-2 py-1">
              <Image
                src="/images/logo-forza.png"
                alt="Forza Motos"
                width={120}
                height={40}
                style={{ objectFit: 'contain', height: 32, width: 'auto' }}
                priority
              />
            </Link>
          )}
          <button
            onClick={alternarRecolhida}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
            title={recolhida ? 'Expandir menu' : 'Recolher menu'}
            className="ml-auto rounded-lg p-1.5 text-brand-dim transition-colors hover:bg-brand-tint-2 hover:text-brand-text"
          >
            {recolhida ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <Conteudo user={user} badges={badges} recolhida={recolhida} />
      </aside>

      {/* ── Gaveta mobile ── */}
      {gaveta && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGaveta(false)
          }}
        >
          <div className="absolute inset-0 bg-[color:var(--brand-overlay)] backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 flex h-full w-[268px] flex-col border-r border-brand-border bg-brand-sidebar">
            <div className="flex items-center justify-between border-b border-brand-hair px-3 py-3">
              <div className="rounded-xl bg-white px-2 py-1">
                <Image
                  src="/images/logo-forza.png"
                  alt="Forza Motos"
                  width={120}
                  height={40}
                  style={{ objectFit: 'contain', height: 30, width: 'auto' }}
                />
              </div>
              <button
                onClick={() => setGaveta(false)}
                aria-label="Fechar menu"
                className="rounded-lg p-1.5 text-brand-dim hover:bg-brand-tint-2 hover:text-brand-text"
              >
                <X size={18} />
              </button>
            </div>
            <Conteudo user={user} badges={badges} recolhida={false} onNavegar={() => setGaveta(false)} />
          </aside>
        </div>
      )}

      {/* ── Barra inferior mobile ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-brand-border bg-brand-sidebar px-1 py-1.5 lg:hidden">
        {NAV_MOBILE.map((item) => {
          const ativo = ehAtivo(item)
          const badge = item.badge ? badges[item.badge] : undefined
          const Icone = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={ativo ? 'page' : undefined}
              className={cn(
                'flex min-w-[56px] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold transition-all',
                ativo ? 'text-brand-accent' : 'text-brand-dim',
              )}
            >
              <span className="relative">
                <Icone size={19} />
                {!!badge && badge > 0 && (
                  <span
                    className={cn(
                      'absolute -right-1.5 -top-1 h-2 w-2 rounded-full ring-2 ring-brand-sidebar',
                      item.urgente ? 'bg-brand-danger' : 'bg-brand-accent',
                    )}
                  />
                )}
              </span>
              {item.label.split(' ')[0]}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
