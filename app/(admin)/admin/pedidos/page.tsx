export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import Link from 'next/link'

const STATUS_OPTIONS = ['TODOS', 'AGUARDANDO_PAGAMENTO', 'CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE', 'CANCELADO']

export const metadata = { title: 'Pedidos — Forza Admin' }

export default async function PedidosAdminPage({ searchParams }: { searchParams: { status?: string; page?: string } }) {
  const page = Number(searchParams.page ?? 1)
  const pageSize = 25
  const where: any = {}
  if (searchParams.status && searchParams.status !== 'TODOS') where.status = searchParams.status

  const [pedidos, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: true, items: true },
    }),
    prisma.order.count({ where }),
  ])

  const pages = Math.ceil(total / pageSize)

  return (
    <div>
      <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight mb-6">Pedidos</h1>

      {/* Filtro status */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_OPTIONS.map((s) => (
          <a
            key={s}
            href={`?status=${s}`}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 capitalize ${
              (searchParams.status ?? 'TODOS') === s
                ? 'bg-gradient-to-r from-brand-accent to-brand-accent-hover text-white shadow-md shadow-brand-accent/20'
                : 'bg-white/5 text-brand-muted hover:text-brand-text hover:bg-white/10 border border-white/10'
            }`}
          >
            {s.replace(/_/g, ' ').toLowerCase()}
          </a>
        ))}
      </div>

      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto admin-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-border/20 bg-white/[0.01]">
              <tr className="text-xs text-brand-muted uppercase tracking-widest">
                <th className="text-left px-6 py-3 font-medium">Pedido</th>
                <th className="text-left px-6 py-3 font-medium">Cliente</th>
                <th className="text-left px-6 py-3 font-medium">Itens</th>
                <th className="text-left px-6 py-3 font-medium">Total</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="text-left px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-6 py-3.5 font-semibold text-brand-accent">
                    <Link href={`/admin/pedidos/${p.id}`} className="hover:text-brand-accent-hover transition-colors">
                      {p.orderNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-brand-muted">
                    <div className="text-brand-text">{p.user?.nome ?? 'Visitante'}</div>
                    <div className="text-xs text-brand-muted">{p.user?.email}</div>
                  </td>
                  <td className="px-6 py-3.5 text-brand-muted">{p.items.length}</td>
                  <td className="px-6 py-3.5 text-brand-text font-semibold">{formatPrice(Number(p.total))}</td>
                  <td className="px-6 py-3.5">{statusBadge(p.status)}</td>
                  <td className="px-6 py-3.5 text-brand-muted">{formatDate(p.createdAt)}</td>
                  <td className="px-6 py-3.5">
                    <Link href={`/admin/pedidos/${p.id}`} className="text-xs text-brand-muted hover:text-brand-text transition-colors">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-brand-border/20 flex items-center justify-between text-xs text-brand-muted bg-white/[0.02]">
          <span>{total} pedido(s) encontrado(s)</span>
          {pages > 1 && (
            <div className="flex gap-1">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?${new URLSearchParams({ ...searchParams, page: String(p) })}`}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200 font-medium ${
                    p === page ? 'bg-brand-accent text-white shadow-md shadow-brand-accent/30' : 'bg-white/5 text-brand-muted hover:text-brand-text hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {p}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
