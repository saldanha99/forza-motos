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
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-brand-muted transition-colors
        border border-brand-border bg-brand-surface-2 hover:bg-brand-accent-soft hover:text-brand-text disabled:opacity-50"
    >
      {loading ? (
        <RefreshCw size={11} className="animate-spin" />
      ) : status === 'ok' ? (
        <CheckCircle2 size={11} className="text-brand-success" />
      ) : status === 'error' ? (
        <AlertCircle size={11} className="text-brand-danger" />
      ) : (
        <RefreshCw size={11} />
      )}
      Sync
    </button>
  )
}
