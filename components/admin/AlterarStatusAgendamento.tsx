'use client'

import { useEffect, useState } from 'react'
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
  const [valor, setValor] = useState(statusAtual)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // O servidor pode devolver um status novo (router.refresh() ou navegação);
  // só sincroniza fora de um salvamento em curso, pra não pisar no otimista.
  useEffect(() => {
    if (!loading) setValor(statusAtual)
  }, [statusAtual, loading])

  async function alterar(novoStatus: string) {
    if (novoStatus === valor || loading) return

    const anterior = valor
    setValor(novoStatus) // otimista: rótulo já reflete a escolha enquanto salva
    setLoading(true)
    try {
      // PATCH de admin: além do status, replica reserva de estoque
      // (concluído consome, cancelado libera) — o PUT completo não faz isso.
      const res = await fetch(`/api/admin/agendamentos/${agendamentoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success('Status atualizado!')
      router.refresh()
    } catch {
      setValor(anterior) // reverte o otimista
      toast.error('Erro ao atualizar o status')
    } finally {
      setLoading(false)
    }
  }

  // Enquanto salva, o rótulo da opção escolhida avisa que a mudança está em curso.
  const opcoes = OPCOES.map((o) => ({
    ...o,
    label: loading && o.valor === valor ? `${o.label}…` : o.label,
  }))

  return (
    <GrupoOpcoes
      valor={valor}
      opcoes={opcoes}
      onChange={alterar}
      disabled={loading}
    />
  )
}
