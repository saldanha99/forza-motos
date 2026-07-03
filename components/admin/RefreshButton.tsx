'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

export function RefreshButton() {
  const router = useRouter()
  const [girando, setGirando] = useState(false)

  return (
    <button
      onClick={() => {
        setGirando(true)
        router.refresh()
        setTimeout(() => setGirando(false), 800)
      }}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white/5 border border-brand-border/30 text-brand-muted hover:text-brand-text hover:border-brand-accent/40 transition-all"
    >
      <RefreshCw size={14} className={girando ? 'animate-spin' : ''} />
      Atualizar
    </button>
  )
}
