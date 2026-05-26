'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Botão "Reindexar agora" — dispara o retry de URLs que falharam nas
 * últimas 24h. Útil quando o admin vê falhas no dashboard e quer
 * forçar reenvio sem esperar o cron noturno.
 */
export function ReindexNowButton() {
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function handleClick() {
    setCarregando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/seo/retry', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setResultado(`✅ ${json.reenviadas} URLs reenviadas (${json.falhas || 0} falhas)`)
      setTimeout(() => setResultado(null), 5000)
    } catch (e: any) {
      setResultado(`❌ ${e.message}`)
      setTimeout(() => setResultado(null), 5000)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        disabled={carregando}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-md shadow-brand-accent/20"
      >
        <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
        {carregando ? 'Reenviando...' : 'Reenviar falhas'}
      </button>
      {resultado && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-black/80 border border-brand-border/40 rounded-lg text-xs whitespace-nowrap shadow-xl z-10">
          {resultado}
        </div>
      )}
    </div>
  )
}
