'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  produtoId: string
  hasTinyId: boolean
}

export function SyncProdutoButton({ produtoId, hasTinyId }: Props) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  if (!hasTinyId) return null

  async function handleSync(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)
    setStatus('idle')
    try {
      const res = await fetch(`/api/admin/produtos/${produtoId}/sync`, { method: 'POST' })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setStatus('ok')
      setMsg(data.aviso || `preço R$${data.campos?.preco?.toFixed(2)} · estoque ${data.campos?.estoque}`)
    } catch (e: any) {
      setStatus('error')
      setMsg(e.message || 'Erro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      title={status === 'ok' ? msg : status === 'error' ? msg : 'Sincronizar com Tiny'}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors disabled:opacity-50
        bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white"
    >
      {loading ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : status === 'ok' ? (
        <CheckCircle2 size={11} className="text-green-400" />
      ) : status === 'error' ? (
        <AlertCircle size={11} className="text-red-400" />
      ) : (
        <RefreshCw size={11} />
      )}
      Sync
    </button>
  )
}
