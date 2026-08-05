'use client'

import { useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Botao } from '@/components/admin/ui/primitives'

/**
 * Botão "Reindexar agora" — dispara o retry de URLs que falharam nas
 * últimas 24h. Útil quando o admin vê falhas no dashboard e quer
 * forçar reenvio sem esperar o cron noturno.
 */
export function ReindexNowButton() {
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<{ texto: string; erro: boolean } | null>(null)

  async function handleClick() {
    setCarregando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/seo/retry', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro')
      setResultado({
        texto: `${json.reenviadas} URLs reenviadas (${json.falhas || 0} falhas)`,
        erro: false,
      })
      setTimeout(() => setResultado(null), 5000)
    } catch (e: any) {
      setResultado({ texto: e.message, erro: true })
      setTimeout(() => setResultado(null), 5000)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="relative">
      <Botao onClick={handleClick} disabled={carregando}>
        <RefreshCw size={14} className={carregando ? 'animate-spin' : ''} />
        {carregando ? 'Reenviando...' : 'Reenviar falhas'}
      </Botao>
      {resultado && (
        <div
          className={cn(
            'absolute right-0 top-full z-10 mt-2 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-brand-border bg-brand-elevated px-3 py-2 text-xs shadow-pop',
            resultado.erro ? 'text-brand-danger' : 'text-brand-success',
          )}
        >
          {resultado.erro ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
          {resultado.texto}
        </div>
      )}
    </div>
  )
}
