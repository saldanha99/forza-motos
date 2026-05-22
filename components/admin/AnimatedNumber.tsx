'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number | string
  prefix?: string
  suffix?: string
  duration?: number
  decimals?: number
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  duration = 1200,
  decimals = 0,
}: Props) {
  const [display, setDisplay] = useState('0')
  const frameRef = useRef<number | null>(null)

  // If value is not a plain number string, display as-is
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  const isNumeric = !isNaN(numericValue)

  useEffect(() => {
    if (!isNumeric) {
      setDisplay(String(value))
      return
    }

    const start = performance.now()
    const from = 0

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      const current = from + (numericValue - from) * eased

      setDisplay(
        decimals > 0
          ? current.toFixed(decimals)
          : Math.round(current).toLocaleString('pt-BR'),
      )

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick)
      }
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericValue, duration])

  return (
    <span>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}
