'use client'

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
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        ref={barRef}
        className="h-full bg-[#d42b2b] origin-left"
        style={{ transform: 'scaleX(0)', willChange: 'transform', transition: 'none' }}
      />
    </div>
  )
}

/** Expõe --scroll-velocity no root para micro-efeitos CSS */
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
        duration: prefersReduced ? 0 : 1.35,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: !prefersReduced,
        wheelMultiplier: 0.88,
        touchMultiplier: 1.6,
        lerp: prefersReduced ? 1 : undefined,
      }}
    >
      <ScrollProgressBar />
      <VelocityTracker />
      {children}
    </ReactLenis>
  )
}
