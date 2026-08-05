'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { GrupoOpcoes } from '@/components/admin/ui/form'
import { STATUS_AGENDAMENTO } from '@/lib/admin/status'

const OPCOES = Object.entries(STATUS_AGENDAMENTO).map(([valor, def]) => ({
  valor,
  label: def.label,
}))

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
    <GrupoOpcoes
      valor={statusAtual}
      opcoes={OPCOES}
      onChange={alterar}
      disabled={loading}
    />
  )
}
