export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { KpiCard } from '@/components/admin/KpiCard'
import { FadeIn } from '@/components/admin/FadeIn'
import { ShoppingBag, Wrench, Users, TrendingUp } from 'lucide-react'

export const metadata = { title: 'CRM — Forza Admin' }

const FUNIL_COR: Record<string, string> = {
  LEAD:       'bg-brand-surface-2 border border-brand-border/30 text-brand-muted',
  ORCAMENTO:  'bg-sky-500/10 border border-sky-500/20 text-sky-300',
  FECHADO:    'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300',
  RECORRENTE: 'bg-purple-500/10 border border-purple-500/20 text-purple-300',
}

const ORIGEM_COR: Record<string, string> = {
  ECOMMERCE:    'bg-sky-500/10 text-sky-300',
  MERCADOLIVRE: 'bg-amber-500/10 text-amber-300',
  AGENDAMENTO:  'bg-orange-500/10 text-orange-300',
  MANUAL:       'bg-brand-surface-2 text-brand-muted',
}

const ORIGEM_LABEL: Record<string, string> = {
  ECOMMERCE:    '🛒 E-commerce',
  MERCADOLIVRE: '🏪 Mercado Livre',
  AGENDAMENTO:  '🔧 Serviço',
  MANUAL:       '✏️ Manual',
}

export default async function ClientesAdminPage({
  searchParams,
}: {
  searchParams: { categoria?: string }
}) {
  const categoria = searchParams.categoria ?? 'todos'

  const clientes = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      // CRM foca no e-commerce próprio — clientes do Mercado Livre ficam fora
      origem: { not: 'MERCADOLIVRE' },
      ...(categoria === 'ecommerce'    && { origem: 'ECOMMERCE' }),
      ...(categoria === 'servico'      && { origem: 'AGENDAMENTO' }),
    },
    include: {
      crm: true,
      orders: { where: { status: { not: 'CANCELADO' } } },
      appointments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  const totalEcommerce    = clientes.filter(c => c.origem === 'ECOMMERCE').length
  const totalServico      = clientes.filter(c => c.origem === 'AGENDAMENTO').length
  const recorrentes       = clientes.filter(c => (c.crm?.etapaFunil ?? '') === 'RECORRENTE').length

  const abas = [
    { key: 'todos',     label: 'Todos',          icon: Users,       count: clientes.length },
    { key: 'ecommerce', label: 'E-commerce',      icon: ShoppingBag, count: totalEcommerce },
    { key: 'servico',   label: 'Serviço / Box',   icon: Wrench,      count: totalServico },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">CRM Inteligente</h1>
        <p className="text-brand-muted text-sm mt-1">
          Clientes do e-commerce e agendamentos de serviço
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <FadeIn delay={0}>
          <KpiCard label="Total"         value={clientes.length} icon={Users} />
        </FadeIn>
        <FadeIn delay={80}>
          <KpiCard label="E-commerce"    value={totalEcommerce} icon={ShoppingBag} />
        </FadeIn>
        <FadeIn delay={160}>
          <KpiCard label="Box / Serviço" value={totalServico}   icon={Wrench} />
        </FadeIn>
        <FadeIn delay={240}>
          <KpiCard label="Recorrentes"   value={recorrentes}    icon={TrendingUp} />
        </FadeIn>
      </div>

      {/* Abas de filtro */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {abas.map(a => (
          <Link
            key={a.key}
            href={`/admin/clientes?categoria=${a.key}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              categoria === a.key
                ? 'bg-gradient-to-r from-brand-accent to-brand-accent-hover text-white shadow-md shadow-brand-accent/20'
                : 'bg-white/5 border border-white/10 text-brand-muted hover:text-brand-text hover:bg-white/10'
            }`}
          >
            <a.icon size={14} />
            {a.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              categoria === a.key
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-brand-muted border border-white/10'
            }`}>
              {a.count}
            </span>
          </Link>
        ))}
      </div>

      {/* Tabela */}
      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto admin-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-border/20 bg-white/[0.01]">
              <tr className="text-xs text-brand-muted uppercase tracking-widest">
                <th className="text-left px-6 py-3 font-medium">Cliente</th>
                <th className="text-left px-6 py-3 font-medium">Origem</th>
                <th className="text-left px-6 py-3 font-medium">Pedidos</th>
                <th className="text-left px-6 py-3 font-medium">Total gasto</th>
                <th className="text-left px-6 py-3 font-medium">Serviços</th>
                <th className="text-left px-6 py-3 font-medium">Funil</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-brand-muted text-sm">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              )}
              {clientes.map(c => (
                <tr key={c.id} className="border-b border-brand-border/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-medium text-brand-text">{c.nome ?? '—'}</div>
                    <div className="text-xs text-brand-muted">{c.email}</div>
                    {c.telefone && <div className="text-xs text-brand-muted">{c.telefone}</div>}
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border ${ORIGEM_COR[c.origem]}`}>
                      {ORIGEM_LABEL[c.origem]}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-brand-muted">{c.orders.length}</td>
                  <td className="px-6 py-3.5 text-brand-text font-semibold">
                    {formatPrice(Number(c.crm?.totalGasto ?? 0))}
                  </td>
                  <td className="px-6 py-3.5 text-brand-muted">
                    {c.appointments.length > 0
                      ? `${c.crm?.totalServicos ?? c.appointments.length}x`
                      : <span className="text-brand-muted/30">—</span>
                    }
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium border ${FUNIL_COR[c.crm?.etapaFunil ?? 'LEAD']}`}>
                      {c.crm?.etapaFunil ?? 'LEAD'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <Link href={`/admin/clientes/${c.id}`} className="text-xs text-brand-muted hover:text-brand-text transition-colors">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
