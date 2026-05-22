'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = ['pendente', 'confirmado', 'concluido', 'cancelado']

export function AlterarStatusAgendamento({
  agendamentoId,
  statusAtual,
}: {
  agendamentoId: string
  statusAtual: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function alterar(status: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/agendamentos/${agendamentoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status atualizado!')
      router.refresh()
    } catch {
      toast.error('Erro ao atualizar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <select
      value={statusAtual}
      onChange={(e) => alterar(e.target.value)}
      disabled={loading}
      className="bg-brand-surface-2 border border-brand-border text-brand-text text-xs rounded-xl px-2 py-2 focus:outline-none focus:border-brand-accent transition-colors"
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}
