'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const FUNIS = ['LEAD', 'ORCAMENTO', 'FECHADO', 'RECORRENTE']

interface CRM {
  totalPedidos?: number
  totalGasto?: number
  ultimaCompra?: string
  notas?: string
  etapaFunil?: string
}

export function ClienteCRMForm({ userId, crm }: { userId: string; crm: CRM | null }) {
  const [etapa, setEtapa] = useState(crm?.etapaFunil ?? 'LEAD')
  const [notas, setNotas] = useState(crm?.notas ?? '')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function salvar() {
    setLoading(true)
    try {
      const res = await fetch(`/api/clientes/${userId}/crm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapaFunil: etapa, notas }),
      })
      if (!res.ok) throw new Error()
      toast.success('CRM atualizado!')
      router.refresh()
    } catch {
      toast.error('Erro ao salvar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
      <h2 className="font-rajdhani font-semibold text-lg text-white">CRM</h2>

      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-zinc-600 text-xs">Total de pedidos</dt>
          <dd className="text-white">{crm?.totalPedidos ?? 0}</dd>
        </div>
        <div>
          <dt className="text-zinc-600 text-xs">Total gasto</dt>
          <dd className="text-white">{formatPrice(Number(crm?.totalGasto ?? 0))}</dd>
        </div>
        <div>
          <dt className="text-zinc-600 text-xs">Última compra</dt>
          <dd className="text-white">{crm?.ultimaCompra ? formatDate(crm.ultimaCompra) : '-'}</dd>
        </div>
      </dl>

      <div>
        <label className="text-sm text-zinc-400 font-medium block mb-2">Etapa do funil</label>
        <div className="grid grid-cols-2 gap-2">
          {FUNIS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setEtapa(f)}
              className={`text-xs py-2 rounded border transition-colors ${
                etapa === f
                  ? 'border-vermelho bg-vermelho/10 text-vermelho'
                  : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-zinc-400 font-medium block mb-1">Notas</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-vermelho resize-none"
          placeholder="Observações sobre o cliente..."
        />
      </div>

      <Button onClick={salvar} loading={loading} className="w-full" size="sm">
        Salvar CRM
      </Button>
    </div>
  )
}
