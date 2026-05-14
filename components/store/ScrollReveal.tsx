'use client'

import { useEffect, useRef, ReactNode } from 'react'

type RevealType = 'up' | 'left' | 'right' | 'scale' | 'blur' | 'blur-up'

interface Props {
  children: ReactNode
  className?: string
  delay?: number
  /** @deprecated use `type` instead — kept for backward compat */
  direction?: 'up' | 'left'
  type?: RevealType
  threshold?: number
}

const CLASS_MAP: Record<RevealType, string> = {
  'up':      'reveal',
  'left':    'reveal-left',
  'right':   'reveal-right',
  'scale':   'reveal-scale',
  'blur':    'reveal-blur',
  'blur-up': 'reveal-blur-up',
}

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction,
  type,
  threshold = 0.1,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // explicit `type` wins, then backward-compat `direction`, then default 'up'
  const resolvedType: RevealType =
    type ?? (direction === 'left' ? 'left' : 'up')

  const revealClass = CLASS_MAP[resolvedType]

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      el.classList.add('visible')
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('visible'), delay)
          observer.unobserve(el)
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -48px 0px',
      }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [delay, threshold])

  return (
    <div ref={ref} className={`${revealClass} ${className}`}>
      {children}
    </div>
  )
}
