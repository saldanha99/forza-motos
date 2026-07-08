'use client'

import { useState } from 'react'
import { Check, X, LoaderCircle } from 'lucide-react'

export function CuradoriaToggle({
  produtoId,
  inicial,
}: {
  produtoId: string
  inicial: boolean
}) {
  const [manter, setManter] = useState(inicial)
  const [carregando, setCarregando] = useState(false)

  async function alternar(novo: boolean) {
    setCarregando(true)
    try {
      const r = await fetch(`/api/admin/produtos/${produtoId}/curadoria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manter: novo }),
      })
      if (r.ok) setManter(novo)
    } finally {
      setCarregando(false)
    }
  }

  return (
    <button
      onClick={() => alternar(!manter)}
      disabled={carregando}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all shrink-0 ${
        manter
          ? 'bg-emerald-500/90 hover:bg-emerald-500 text-white'
          : 'bg-white/5 border border-brand-border/40 text-brand-muted hover:text-brand-text hover:border-brand-accent/40'
      }`}
      title={manter ? 'Este produto fica na loja' : 'Clique para manter na loja'}
    >
      {carregando ? (
        <LoaderCircle size={13} className="animate-spin" />
      ) : manter ? (
        <Check size={13} />
      ) : (
        <X size={13} />
      )}
      {manter ? 'Na loja' : 'Fora'}
    </button>
  )
}
