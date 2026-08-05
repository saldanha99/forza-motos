'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TemaAdmin = 'dark' | 'light'

const COOKIE = 'forza_admin_tema'
const UM_ANO = 60 * 60 * 24 * 365

type Ctx = { tema: TemaAdmin; alternar: () => void; definir: (t: TemaAdmin) => void }

const AdminThemeContext = createContext<Ctx>({
  tema: 'dark',
  alternar: () => {},
  definir: () => {},
})

export const useTemaAdmin = () => useContext(AdminThemeContext)

/**
 * Tema do painel — independente do tema da loja.
 *
 * O valor inicial vem de um cookie lido no server (`lerTemaAdmin`), então o
 * HTML já chega pintado: não há flash de tema errado. Daqui pra frente a
 * troca é só um atributo no elemento raiz do shell + o cookie atualizado.
 */
export function AdminThemeProvider({
  temaInicial,
  children,
}: {
  temaInicial: TemaAdmin
  children: React.ReactNode
}) {
  const [tema, setTema] = useState<TemaAdmin>(temaInicial)

  // O color-scheme fica no próprio nó do shell (via CSS), não em <html>:
  // a loja tem tema independente e não pode ser arrastada junto.
  const definir = useCallback((t: TemaAdmin) => {
    setTema(t)
    document.cookie = `${COOKIE}=${t}; path=/; max-age=${UM_ANO}; SameSite=Lax`
  }, [])

  const alternar = useCallback(
    () => definir(tema === 'dark' ? 'light' : 'dark'),
    [tema, definir],
  )

  // Espelha o tema no <body> para que o que é renderizado fora do shell
  // (toasts do react-hot-toast, por exemplo) também siga o tema do painel.
  useEffect(() => {
    document.body.dataset.adminTheme = tema
    return () => {
      delete document.body.dataset.adminTheme
    }
  }, [tema])

  // Atalho: Shift+D alterna o tema sem tirar a mão do teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null
      const digitando =
        alvo?.tagName === 'INPUT' ||
        alvo?.tagName === 'TEXTAREA' ||
        alvo?.isContentEditable
      if (digitando || !e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'd') {
        e.preventDefault()
        alternar()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alternar])

  return (
    <AdminThemeContext.Provider value={{ tema, alternar, definir }}>
      <div data-admin-theme={tema}>{children}</div>
    </AdminThemeContext.Provider>
  )
}

/** Botão de sol/lua com a bolinha deslizando entre os dois estados. */
export function ThemeToggleAdmin({ className }: { className?: string }) {
  const { tema, alternar } = useTemaAdmin()
  const claro = tema === 'light'

  return (
    <button
      type="button"
      onClick={alternar}
      role="switch"
      aria-checked={claro}
      aria-label={claro ? 'Ativar modo escuro' : 'Ativar modo claro'}
      title={`${claro ? 'Modo escuro' : 'Modo claro'} · Shift+D`}
      className={cn(
        'relative h-8 w-[58px] shrink-0 rounded-full border border-brand-border bg-brand-surface-2',
        'transition-colors hover:border-brand-border-strong',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent',
        className,
      )}
    >
      {/* Trilho: os dois ícones ficam sempre visíveis, o botão indica qual está ativo */}
      <Moon
        size={13}
        className={cn(
          'absolute left-[9px] top-1/2 -translate-y-1/2 transition-colors',
          claro ? 'text-brand-dim' : 'text-brand-on-accent',
        )}
      />
      <Sun
        size={13}
        className={cn(
          'absolute right-[9px] top-1/2 -translate-y-1/2 transition-colors',
          claro ? 'text-brand-on-accent' : 'text-brand-dim',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-brand-accent shadow-cta',
          'transition-transform duration-300 ease-out',
          claro ? 'translate-x-[27px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}
