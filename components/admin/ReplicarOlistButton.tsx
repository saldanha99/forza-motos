'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, LoaderCircle } from 'lucide-react'
import { Botao } from '@/components/admin/ui/primitives'

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
      <Botao
        variante="perigo"
        tamanho="sm"
        onClick={replicar}
        disabled={estado === 'enviando'}
        className="uppercase tracking-wider"
      >
        {estado === 'enviando' ? (
          <LoaderCircle size={14} className="animate-spin" />
        ) : (
          <CloudUpload size={14} />
        )}
        {estado === 'enviando' ? 'Replicando…' : 'Replicar no Olist'}
      </Botao>
      {estado === 'erro' && <p className="max-w-[240px] text-right text-[11px] text-brand-danger">{erro}</p>}
    </div>
  )
}
