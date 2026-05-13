'use client'

import { useEffect, useRef } from 'react'
import { Truck, Zap, ShieldCheck, Wrench } from 'lucide-react'

const ITEMS = [
  {
    icon: Truck,
    title: 'Entrega Brasil',
    sub: 'Em todo o território nacional',
  },
  {
    icon: Zap,
    title: 'Envio em 24h',
    sub: 'Despacho no mesmo dia útil',
  },
  {
    icon: ShieldCheck,
    title: 'Pagamento Seguro',
    sub: 'Compra 100% protegida',
  },
  {
    icon: Wrench,
    title: 'Oficina Própria',
    sub: 'Box rápido sem agendamento',
  },
]

export function TrustBar() {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      itemRefs.current.forEach((el) => {
        if (el) {
          el.style.opacity = '1'
          el.style.transform = 'none'
        }
      })
      return
    }

    const observers: IntersectionObserver[] = []

    itemRefs.current.forEach((el, i) => {
      if (!el) return

      el.style.opacity = '0'
      el.style.transform = 'translateY(24px)'
      el.style.transition = `opacity 0.45s ease ${i * 100}ms, transform 0.45s ease ${i * 100}ms`

      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              ;(entry.target as HTMLElement).style.opacity = '1'
              ;(entry.target as HTMLElement).style.transform = 'translateY(0)'
              obs.unobserve(entry.target)
            }
          })
        },
        { threshold: 0.15 }
      )

      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((o) => o.disconnect())
  }, [])

  return (
    <div className="border-y border-[#eee] bg-white">
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-7">
        <div className="grid grid-cols-2 md:flex md:justify-around gap-y-6 gap-x-4">
          {ITEMS.map(({ icon: Icon, title, sub }, i) => (
            <div
              key={title}
              ref={(el) => { itemRefs.current[i] = el }}
              className="flex items-center gap-3 group"
            >
              <div className="shrink-0 text-[#d42b2b] transition-transform duration-300 group-hover:scale-110">
                <Icon size={28} strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-barlow font-bold text-[14px] text-[#111] leading-none mb-0.5">
                  {title}
                </p>
                <p className="font-inter text-[11px] text-[#888]">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
