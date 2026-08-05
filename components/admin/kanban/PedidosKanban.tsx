'use client'

import Link from 'next/link'
import { CloudOff, Package, Truck } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { KanbanBoard } from './KanbanBoard'
import { Badge } from '@/components/admin/ui/primitives'
// As colunas vêm de lib/admin/kanban.ts — de propósito NÃO são reexportadas
// daqui: importar valor de módulo 'use client' num server component devolve
// um proxy, e qualquer `.filter()`/`.map()` nele estoura só em runtime.
import { COLUNAS_PEDIDO, type ItemKanban } from '@/lib/admin/kanban'

export type PedidoKanban = ItemKanban & {
  numero: string
  cliente: string
  itens: number
  total: number
  criadoEm: string
  retirada: boolean
  /** Pago mas ainda não replicado no Olist — sem NF e sem baixa de estoque. */
  semOlist: boolean
}


async function alterarStatus(id: string, status: string) {
  const r = await fetch(`/api/pedidos/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!r.ok) {
    const { error } = await r.json().catch(() => ({ error: '' }))
    throw new Error(error || 'O servidor recusou a mudança de status.')
  }
}

export function PedidosKanban({ pedidos }: { pedidos: PedidoKanban[] }) {
  return (
    <KanbanBoard<PedidoKanban>
      colunas={COLUNAS_PEDIDO}
      itens={pedidos}
      onMover={(p, para) => alterarStatus(p.id, para)}
      resumoColuna={(itens) =>
        itens.length > 0 ? `${formatPrice(itens.reduce((s, i) => s + i.total, 0))} na coluna` : null
      }
      renderCard={(p, { overlay }) => (
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            {overlay ? (
              <span className="font-semibold text-brand-accent">{p.numero}</span>
            ) : (
              <Link
                href={`/admin/pedidos/${p.id}`}
                className="font-semibold text-brand-accent hover:underline"
              >
                {p.numero}
              </Link>
            )}
            <span className="shrink-0 font-barlow text-sm font-bold tabular-nums text-brand-text">
              {formatPrice(p.total)}
            </span>
          </div>

          <p className="truncate text-xs text-brand-muted">{p.cliente}</p>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-brand-dim">
            <span className="inline-flex items-center gap-1">
              <Package size={11} />
              {p.itens} {p.itens === 1 ? 'item' : 'itens'}
            </span>
            <span aria-hidden>·</span>
            <span>{p.criadoEm}</span>
            {p.retirada && (
              <Badge tom="info" className="ml-auto">
                <Truck size={10} /> Retirada
              </Badge>
            )}
          </div>

          {/* O alerta mais caro do fluxo: pago, mas sem NF nem baixa no ERP */}
          {p.semOlist && (
            <p className="flex items-center gap-1.5 rounded-lg bg-brand-danger-soft px-2 py-1 text-[11px] font-semibold text-brand-danger">
              <CloudOff size={11} className="shrink-0" />
              Não replicado no Olist
            </p>
          )}
        </div>
      )}
    />
  )
}
