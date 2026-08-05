'use client'

import { useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CuradoriaToggle({
  produtoId,
  inicial,
}: {
  produtoId: string
  /** true = está na loja */
  inicial: boolean
}) {
  const [visivel, setVisivel] = useState(inicial)
  const [carregando, setCarregando] = useState(false)

  async function alternar() {
    const novo = !visivel
    setCarregando(true)
    try {
      const r = await fetch(`/api/admin/produtos/${produtoId}/curadoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visivel: novo }),
      })
      if (r.ok) setVisivel(novo)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <button
      onClick={alternar}
      disabled={carregando}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition',
        // Ligado/desligado precisa ser óbvio a um metro de distância — por
        // isso o estado "na loja" usa fundo sólido em vez de um tom sutil.
        visivel
          ? 'bg-brand-success text-brand-on-accent hover:brightness-95'
          : 'border border-brand-border bg-brand-surface-2 text-brand-muted hover:border-brand-border-strong hover:text-brand-text',
      )}
      title={visivel ? 'Está na loja — clique para ocultar' : 'Oculto — clique para colocar na loja'}
    >
      {carregando ? (
        <LoaderCircle size={13} className="animate-spin" />
      ) : visivel ? (
        <Eye size={13} />
      ) : (
        <EyeOff size={13} />
      )}
      {visivel ? 'Na loja' : 'Oculto'}
    </button>
  )
}
