export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import Link from 'next/link'

const STATUS_OPTIONS = ['TODOS', 'AGUARDANDO_PAGAMENTO', 'CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE', 'CANCELADO']

export const metadata = { title: 'Pedidos' }

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
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-6">Pedidos</h1>

      {/* Filtro status */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_OPTIONS.map((s) => (
          <a
            key={s}
            href={`?status=${s}`}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize ${
              (searchParams.status ?? 'TODOS') === s
                ? 'bg-vermelho text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {s.replace(/_/g, ' ').toLowerCase()}
          </a>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950">
              <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Pedido</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Itens</th>
                <th className="text-left px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Data</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-vermelho">
                    <Link href={`/admin/pedidos/${p.id}`}>{p.orderNumber}</Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    <div>{p.user?.nome ?? 'Visitante'}</div>
                    <div className="text-xs text-zinc-600">{p.user?.email}</div>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{p.items.length}</td>
                  <td className="px-5 py-3 text-white font-medium">{formatPrice(Number(p.total))}</td>
                  <td className="px-5 py-3">{statusBadge(p.status)}</td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(p.createdAt)}</td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/pedidos/${p.id}`} className="text-xs text-zinc-500 hover:text-white">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
          <span>{total} pedido(s) encontrado(s)</span>
          {pages > 1 && (
            <div className="flex gap-1">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <a
                  key={p}
                  href={`?${new URLSearchParams({ ...searchParams, page: String(p) })}`}
                  className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                    p === page ? 'bg-vermelho text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
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
