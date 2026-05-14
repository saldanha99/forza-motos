'use client'

/**
 * SmoothScroll — wrapper Lenis para o e-commerce
 *
 * Funcionalidades:
 *   - Scroll suave com easing expo-out
 *   - Barra de progresso vermelha no topo (z-9999)
 *   - CSS var --scroll-vel para micro-animações
 *   - Suporte a âncoras (#secao) com scroll suave
 *   - Respeita prefers-reduced-motion
 *   - Pausa em modais/overlays via data-lenis-prevent
 *
 * NÃO incluir no layout admin — formulários e tabelas
 * se comportam melhor com scroll nativo.
 */

import { useRef } from 'react'
import { ReactLenis, useLenis } from 'lenis/react'

/** Barra de progresso vermelha no topo da página */
function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null)

  useLenis(({ progress }) => {
    if (barRef.current) {
      barRef.current.style.transform = `scaleX(${progress})`
    }
  })

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2.5px] pointer-events-none"
      style={{ zIndex: 'var(--z-progress)' }}
      aria-hidden="true"
    >
      <div
        ref={barRef}
        className="h-full origin-left"
        style={{
          background: 'var(--vermelho)',
          transform: 'scaleX(0)',
          willChange: 'transform',
          transition: 'none',
        }}
      />
    </div>
  )
}

/** Expõe --scroll-vel no root para micro-efeitos CSS nos cards */
function VelocityTracker() {
  useLenis(({ velocity }) => {
    const v = Math.min(Math.abs(velocity) * 0.01, 1).toFixed(3)
    document.documentElement.style.setProperty('--scroll-vel', v)
  })
  return null
}

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const prefersReduced =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  return (
    <ReactLenis
      root
      options={{
        // Duração base do scroll — 0 se usuário prefere motion reduzido
        duration: prefersReduced ? 0 : 1.35,

        // Easing expo-out: rápido no início, suave no final
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),

        // Scroll suave por roda do mouse
        smoothWheel: !prefersReduced,

        // 88% da velocidade natural — não "lutar" contra o usuário
        wheelMultiplier: 0.88,

        // Mobile um pouco mais responsivo
        touchMultiplier: 1.6,

        // Âncoras (#link) com scroll suave automático
        anchors: true,

        // Redução de movimento: lerp = 1 (instantâneo)
        lerp: prefersReduced ? 1 : undefined,
      }}
    >
      <ScrollProgressBar />
      <VelocityTracker />
      {children}
    </ReactLenis>
  )
}

/**
 * Hook para usar Lenis em qualquer componente client
 *
 * @example
 * // Scroll para seção
 * const { scrollTo } = useSmoothScroll()
 * scrollTo('#produtos', { offset: -80 })
 *
 * // Pausar durante modal
 * const { stop, start } = useSmoothScroll()
 * useEffect(() => { stop(); return () => start() }, [])
 */
export function useSmoothScroll() {
  const lenis = useLenis()

  return {
    scrollTo: (target: string | number | HTMLElement, opts?: object) => {
      lenis?.scrollTo(target as any, opts)
    },
    stop: () => lenis?.stop(),
    start: () => lenis?.start(),
    progress: lenis?.progress ?? 0,
    velocity: lenis?.velocity ?? 0,
    isScrolling: lenis?.isScrolling ?? false,
  }
}
