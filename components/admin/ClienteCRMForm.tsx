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
    <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 space-y-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
      <h2 className="font-barlow font-bold text-xl text-brand-text">CRM</h2>

      <dl className="space-y-4 text-sm border-b border-brand-border/20 pb-4">
        <div className="flex justify-between">
          <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">Total de pedidos</dt>
          <dd className="text-brand-text font-bold">{crm?.totalPedidos ?? 0}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">Total gasto</dt>
          <dd className="text-brand-text font-bold text-brand-accent">{formatPrice(Number(crm?.totalGasto ?? 0))}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-brand-muted text-xs font-semibold uppercase tracking-wider">Última compra</dt>
          <dd className="text-brand-text font-semibold">{crm?.ultimaCompra ? formatDate(crm.ultimaCompra) : '-'}</dd>
        </div>
      </dl>

      <div>
        <label className="text-sm text-brand-muted font-medium block mb-3">Etapa do funil</label>
        <div className="grid grid-cols-2 gap-2.5">
          {FUNIS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setEtapa(f)}
              className={`text-xs py-2.5 rounded-xl border font-bold tracking-wider transition-all duration-200 ${
                etapa === f
                  ? 'border-brand-accent bg-brand-accent/15 text-brand-accent shadow-md shadow-brand-accent/10'
                  : 'border-white/10 text-brand-muted hover:border-white/20 hover:bg-white/5'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm text-brand-muted font-medium block mb-2">Notas</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={4}
          className="w-full bg-white/5 border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-brand-text text-sm focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/20 resize-none transition-all duration-200 placeholder:text-brand-muted/50"
          placeholder="Observações sobre o cliente..."
        />
      </div>

      <Button onClick={salvar} loading={loading} className="w-full font-bold uppercase tracking-wider text-xs rounded-xl py-3.5" size="sm">
        Salvar CRM
      </Button>
    </div>
  )
}
