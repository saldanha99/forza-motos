import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { OlistSyncButton } from '@/components/admin/OlistSyncButton'
import Link from 'next/link'
import { ShoppingBag, DollarSign, Users, AlertTriangle } from 'lucide-react'

export const metadata = { title: 'Dashboard Admin' }

export default async function DashboardPage() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [
    pedidosHoje,
    receitaMes,
    clientesNovos,
    produtosBaixoEstoque,
    ultimosPedidos,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: hoje }, status: { not: 'CANCELADO' } },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: {
          gte: new Date(hoje.getFullYear(), hoje.getMonth(), 1),
        },
        status: { not: 'CANCELADO' },
      },
      _sum: { total: true },
    }),
    prisma.user.count({
      where: { createdAt: { gte: new Date(hoje.getFullYear(), hoje.getMonth(), 1) } },
    }),
    prisma.product.count({ where: { estoque: { lt: 5 }, ativo: true } }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { user: true, items: true },
    }),
  ])

  const kpis = [
    { label: 'Pedidos hoje', value: pedidosHoje, icon: ShoppingBag, cor: 'text-blue-400' },
    { label: 'Receita do mês', value: formatPrice(Number(receitaMes._sum.total ?? 0)), icon: DollarSign, cor: 'text-green-400' },
    { label: 'Clientes novos', value: clientesNovos, icon: Users, cor: 'text-purple-400' },
    { label: 'Estoque crítico', value: produtosBaixoEstoque, icon: AlertTriangle, cor: 'text-yellow-400' },
  ]

  return (
    <div>
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-8">Dashboard</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {kpis.map((k) => (
          <div key={k.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{k.label}</p>
              <k.icon size={18} className={k.cor} />
            </div>
            <p className={`font-rajdhani font-bold text-2xl ${k.cor}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* OLIST Sync */}
      <div className="mb-8">
        <OlistSyncButton />
      </div>

      {/* Últimos pedidos */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="font-rajdhani font-semibold text-lg text-white">Últimos Pedidos</h2>
          <Link href="/admin/pedidos" className="text-xs text-vermelho hover:text-red-400">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800">
              <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Pedido</th>
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Total</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {ultimosPedidos.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/admin/pedidos/${p.id}`} className="text-vermelho hover:text-red-400 font-medium">
                      {p.orderNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{p.user?.nome ?? p.user?.email ?? 'Visitante'}</td>
                  <td className="px-5 py-3 text-white font-medium">{formatPrice(Number(p.total))}</td>
                  <td className="px-5 py-3">{statusBadge(p.status)}</td>
                  <td className="px-5 py-3 text-zinc-500">{formatDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
