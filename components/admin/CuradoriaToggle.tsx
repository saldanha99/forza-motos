'use client'

import { useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'

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
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all shrink-0 ${
        visivel
          ? 'bg-emerald-500/90 hover:bg-emerald-500 text-white'
          : 'bg-white/5 border border-brand-border/40 text-brand-muted hover:text-brand-text hover:border-brand-accent/40'
      }`}
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
