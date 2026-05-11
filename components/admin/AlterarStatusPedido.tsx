'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const STATUS_TRANSICOES: Record<string, string[]> = {
  AGUARDANDO_PAGAMENTO: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['SEPARANDO', 'CANCELADO'],
  SEPARANDO: ['ENVIADO', 'CANCELADO'],
  ENVIADO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
}


export function AlterarStatusPedido({ pedidoId, statusAtual }: { pedidoId: string; statusAtual: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const proximos = STATUS_TRANSICOES[statusAtual] ?? []

  async function alterarStatus(novoStatus: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Status atualizado para: ${novoStatus.replace(/_/g, ' ')}`)
      router.refresh()
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setLoading(false)
    }
  }

  if (proximos.length === 0) return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
      <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Alterar Status</h2>
      <div className="space-y-2">
        {proximos.map((s) => (
          <Button
            key={s}
            variant={s === 'CANCELADO' ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            onClick={() => alterarStatus(s)}
            className="w-full"
          >
            {s.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>
    </div>
  )
}
