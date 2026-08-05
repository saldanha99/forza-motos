'use client'

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useState,
} from 'react'
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

/** `useLayoutEffect` avisa quando roda no server; no server não precisamos dele. */
const useEfeitoDeLayout = typeof window === 'undefined' ? useEffect : useLayoutEffect

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
  const [hidratado, setHidratado] = useState(false)

  const definir = useCallback((t: TemaAdmin) => {
    // Transição em `background-color` cujo valor vem de `var()` faz o Chrome
    // congelar a cor antiga quando a variável muda — o painel trocava de tema
    // mas continuava pintado do jeito anterior até um reload. Desligar as
    // transições durante o swap resolve, e ainda deixa a troca instantânea.
    const desligar = document.createElement('style')
    desligar.appendChild(
      document.createTextNode('*,*::before,*::after{transition:none!important}'),
    )
    document.head.appendChild(desligar)

    setTema(t)
    document.cookie = `${COOKIE}=${t}; path=/; max-age=${UM_ANO}; SameSite=Lax`

    requestAnimationFrame(() => {
      // Força o recálculo com as transições ainda desligadas…
      void getComputedStyle(document.body).transitionProperty
      // …e só então religa, no quadro seguinte.
      requestAnimationFrame(() => desligar.remove())
    })
  }, [])

  const alternar = useCallback(
    () => definir(tema === 'dark' ? 'light' : 'dark'),
    [tema, definir],
  )

  /**
   * Depois de hidratar, o atributo migra para o <html>.
   *
   * Num elemento aninhado o Chrome atualiza o *valor* da custom property, mas
   * não invalida as declarações que a consomem no subtree: a troca de tema
   * mudava `--brand-surface` e os cards continuavam pintados com a cor antiga
   * até um reload. Na raiz a invalidação é confiável.
   *
   * É layout effect de propósito: roda depois do commit e antes da pintura, no
   * mesmo quadro em que o `<div>` perde o atributo — assim não pisca.
   */
  useEfeitoDeLayout(() => {
    const raiz = document.documentElement
    raiz.dataset.adminTheme = tema
    setHidratado(true)
    return () => {
      // Ao sair do painel o atributo some, para não vazar na loja.
      delete raiz.dataset.adminTheme
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
      {/* Antes de hidratar o atributo vive aqui, para o primeiro paint já vir
          pintado (o valor veio do cookie lido no server). Depois ele passa a
          morar no <html> e este some, senão continuaria vencendo na cascata.
          O color-scheme fica sempre aqui: assim a loja não é arrastada junto. */}
      <div
        data-admin-theme={hidratado ? undefined : temaInicial}
        className="admin-shell"
        style={{ colorScheme: tema }}
      >
        {children}
      </div>
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
