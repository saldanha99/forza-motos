export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { OlistSyncButton } from '@/components/admin/OlistSyncButton'
import { KpiCard } from '@/components/admin/KpiCard'
import { FadeIn } from '@/components/admin/FadeIn'
import Link from 'next/link'
import { ShoppingBag, DollarSign, Users, AlertTriangle } from 'lucide-react'

export const metadata = { title: 'Dashboard — Forza Admin' }

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

  const receitaNum = Number(receitaMes._sum.total ?? 0)

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">
          Dashboard
        </h1>
        <p className="text-brand-muted text-sm mt-1">
          Visão geral do dia — atualizado agora
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <FadeIn delay={0}>
          <KpiCard
            label="Pedidos hoje"
            value={pedidosHoje}
            icon={ShoppingBag}
          />
        </FadeIn>
        <FadeIn delay={80}>
          <KpiCard
            label="Receita do mês"
            value={receitaNum}
            icon={DollarSign}
            prefix="R$ "
            decimals={2}
          />
        </FadeIn>
        <FadeIn delay={160}>
          <KpiCard
            label="Clientes novos"
            value={clientesNovos}
            icon={Users}
          />
        </FadeIn>
        <FadeIn delay={240}>
          <KpiCard
            label="Estoque crítico"
            value={produtosBaixoEstoque}
            icon={AlertTriangle}
          />
        </FadeIn>
      </div>

      {/* OLIST Sync */}
      <FadeIn delay={300} className="mb-8">
        <OlistSyncButton />
      </FadeIn>

      {/* Últimos pedidos */}
      <FadeIn delay={380}>
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border/20 bg-white/[0.02]">
            <h2 className="font-barlow font-bold text-lg text-brand-text">
              Últimos Pedidos
            </h2>
            <Link
              href="/admin/pedidos"
              className="text-xs text-brand-accent hover:text-brand-accent-hover font-semibold transition-colors flex items-center gap-1"
            >
              Ver todos →
            </Link>
          </div>

          <div className="overflow-x-auto admin-scroll">
            <table className="w-full text-sm">
              <thead className="border-b border-brand-border/20 bg-white/[0.01]">
                <tr className="text-xs text-brand-muted uppercase tracking-widest">
                  <th className="text-left px-6 py-3 font-medium">Pedido</th>
                  <th className="text-left px-6 py-3 font-medium">Cliente</th>
                  <th className="text-left px-6 py-3 font-medium">Total</th>
                  <th className="text-left px-6 py-3 font-medium">Status</th>
                  <th className="text-left px-6 py-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {ultimosPedidos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-brand-border/10 hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <Link
                        href={`/admin/pedidos/${p.id}`}
                        className="text-brand-accent hover:text-brand-accent-hover font-semibold transition-colors"
                      >
                        {p.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-3.5 text-brand-muted">
                      {p.user?.nome ?? p.user?.email ?? 'Visitante'}
                    </td>
                    <td className="px-6 py-3.5 text-brand-text font-semibold">
                      {formatPrice(Number(p.total))}
                    </td>
                    <td className="px-6 py-3.5">{statusBadge(p.status)}</td>
                    <td className="px-6 py-3.5 text-brand-muted">
                      {formatDate(p.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
