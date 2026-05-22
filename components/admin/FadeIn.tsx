'use client'

import { useEffect, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  delay?: number          // ms delay before animation
  className?: string
  threshold?: number
}

export function FadeIn({ children, delay = 0, className, threshold = 0.1 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.classList.add('animate-fade-in-up')
            el.style.opacity = '1'
          }, delay)
          observer.disconnect()
        }
      },
      { threshold },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay, threshold])

  return (
    <div
      ref={ref}
      style={{ opacity: 0 }}
      className={cn('transition-opacity', className)}
    >
      {children}
    </div>
  )
}
