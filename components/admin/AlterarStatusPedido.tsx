'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Card, CardHeader, Botao } from '@/components/admin/ui/primitives'

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
    <Card>
      <CardHeader titulo="Alterar Status" />
      <div className="space-y-2.5 p-5">
        {proximos.map((s) => (
          <Botao
            key={s}
            variante={s === 'CANCELADO' ? 'perigo' : 'primario'}
            tamanho="lg"
            disabled={loading}
            onClick={() => alterarStatus(s)}
            className="w-full font-bold uppercase tracking-wider text-xs"
          >
            {s === 'ENVIADO' && freteServico === 'retirada'
              ? 'Pronto para retirada'
              : s === 'ENTREGUE' && freteServico === 'retirada'
              ? 'Retirado (Entregue)'
              : s.replace(/_/g, ' ')}
          </Botao>
        ))}
      </div>
    </Card>
  )
}
