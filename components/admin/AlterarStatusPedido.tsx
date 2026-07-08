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

export function AlterarStatusPedido({
  pedidoId,
  statusAtual,
  freteServico,
}: {
  pedidoId: string
  statusAtual: string
  freteServico: string | null
}) {
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
      
      const textoStatus = novoStatus === 'ENVIADO' && freteServico === 'retirada'
        ? 'PRONTO PARA RETIRADA'
        : novoStatus === 'ENTREGUE' && freteServico === 'retirada'
        ? 'RETIRADO'
        : novoStatus.replace(/_/g, ' ')

      toast.success(`Status atualizado para: ${textoStatus}`)
      router.refresh()
    } catch {
      toast.error('Erro ao atualizar status')
    } finally {
      setLoading(false)
    }
  }

  if (proximos.length === 0) return null

  return (
    <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
      <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Alterar Status</h2>
      <div className="space-y-2.5">
        {proximos.map((s) => (
          <Button
            key={s}
            variant={s === 'CANCELADO' ? 'danger' : 'primary'}
            size="sm"
            loading={loading}
            onClick={() => alterarStatus(s)}
            className="w-full font-bold uppercase tracking-wider text-xs rounded-xl py-3 font-sans"
          >
            {s === 'ENVIADO' && freteServico === 'retirada'
              ? 'Pronto para retirada'
              : s === 'ENTREGUE' && freteServico === 'retirada'
              ? 'Retirado (Entregue)'
              : s.replace(/_/g, ' ')}
          </Button>
        ))}
      </div>
    </div>
  )
}
