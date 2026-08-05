'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Botao, Card, CardHeader } from '@/components/admin/ui/primitives'
import { Campo, GrupoOpcoes, Textarea, AcoesFormulario } from '@/components/admin/ui/form'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

const FUNIS = [
  { valor: 'LEAD',       label: 'Lead' },
  { valor: 'ORCAMENTO',  label: 'Orçamento' },
  { valor: 'FECHADO',    label: 'Fechado' },
  { valor: 'RECORRENTE', label: 'Recorrente' },
]

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
    <Card>
      <CardHeader titulo="CRM" />
      <div className="space-y-5 p-5">
        <dl className="space-y-3 border-b border-brand-hair pb-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-brand-dim">Total de pedidos</dt>
            <dd className="font-bold text-brand-text">{crm?.totalPedidos ?? 0}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-brand-dim">Total gasto</dt>
            <dd className="font-bold text-brand-accent">{formatPrice(Number(crm?.totalGasto ?? 0))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-brand-dim">Última compra</dt>
            <dd className="font-semibold text-brand-text">{crm?.ultimaCompra ? formatDate(crm.ultimaCompra) : '-'}</dd>
          </div>
        </dl>

        <Campo label="Etapa do funil" dica="Onde este cliente está no funil de relacionamento.">
          <GrupoOpcoes valor={etapa} opcoes={FUNIS} onChange={setEtapa} />
        </Campo>

        <Campo label="Notas" dica="Observações internas sobre o cliente.">
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={4}
            placeholder="Observações sobre o cliente..."
          />
        </Campo>

        <AcoesFormulario>
          <Botao onClick={salvar} disabled={loading} className="w-full">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Salvando…' : 'Salvar CRM'}
          </Botao>
        </AcoesFormulario>
      </div>
    </Card>
  )
}
