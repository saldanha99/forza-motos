'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, LoaderCircle } from 'lucide-react'

export function ReplicarOlistButton({ pedidoId }: { pedidoId: string }) {
  const router = useRouter()
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'erro'>('idle')
  const [erro, setErro] = useState('')

  async function replicar() {
    setEstado('enviando')
    setErro('')
    try {
      const res = await fetch(`/api/admin/pedidos/${pedidoId}/replicar-olist`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok || data.error) {
        setEstado('erro')
        setErro(data.error ?? `Erro HTTP ${res.status}`)
        return
      }
      router.refresh()
      setEstado('idle')
    } catch (e: any) {
      setEstado('erro')
      setErro(e.message)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={replicar}
        disabled={estado === 'enviando'}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-500/90 hover:bg-red-500 text-white transition-colors disabled:opacity-60"
      >
        {estado === 'enviando' ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <CloudUpload size={14} />
        )}
        {estado === 'enviando' ? 'Replicando…' : 'Replicar no Olist'}
      </button>
      {estado === 'erro' && <p className="text-[11px] text-red-400 max-w-[240px] text-right">{erro}</p>}
    </div>
  )
}
