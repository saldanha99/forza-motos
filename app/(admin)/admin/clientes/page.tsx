import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { ShoppingBag, Wrench, Users, TrendingUp, Store } from 'lucide-react'

export const metadata = { title: 'CRM — Forza Motos' }

const FUNIL_COR: Record<string, string> = {
  LEAD:       'bg-zinc-800 text-zinc-400',
  ORCAMENTO:  'bg-blue-900/50 text-blue-300 border border-blue-800',
  FECHADO:    'bg-green-900/50 text-green-300 border border-green-800',
  RECORRENTE: 'bg-purple-900/50 text-purple-300 border border-purple-800',
}

const ORIGEM_COR: Record<string, string> = {
  ECOMMERCE:    'bg-blue-900/40 text-blue-300',
  MERCADOLIVRE: 'bg-yellow-900/40 text-yellow-300',
  AGENDAMENTO:  'bg-orange-900/40 text-orange-300',
  MANUAL:       'bg-zinc-800 text-zinc-400',
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
      ...(categoria === 'ecommerce'    && { origem: 'ECOMMERCE' }),
      ...(categoria === 'ml'           && { origem: 'MERCADOLIVRE' }),
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

  // KPIs
  const totalEcommerce    = clientes.filter(c => c.origem === 'ECOMMERCE').length
  const totalML           = clientes.filter(c => c.origem === 'MERCADOLIVRE').length
  const totalServico      = clientes.filter(c => c.origem === 'AGENDAMENTO').length
  const recorrentes       = clientes.filter(c => (c.crm?.etapaFunil ?? '') === 'RECORRENTE').length

  const abas = [
    { key: 'todos',     label: 'Todos',          icon: Users,       count: clientes.length },
    { key: 'ecommerce', label: 'E-commerce',      icon: ShoppingBag, count: totalEcommerce },
    { key: 'ml',        label: 'Mercado Livre',   icon: Store,       count: totalML },
    { key: 'servico',   label: 'Serviço / Box',   icon: Wrench,      count: totalServico },
  ]

  return (
    <div>
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-2">CRM Inteligente</h1>
      <p className="text-zinc-500 text-sm mb-8">Clientes do e-commerce, Mercado Livre e agendamentos de serviço</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'E-commerce',    value: totalEcommerce, icon: ShoppingBag, cor: 'text-blue-400' },
          { label: 'Mercado Livre', value: totalML,        icon: Store,       cor: 'text-yellow-400' },
          { label: 'Box / Serviço', value: totalServico,   icon: Wrench,      cor: 'text-orange-400' },
          { label: 'Recorrentes',   value: recorrentes,    icon: TrendingUp,  cor: 'text-purple-400' },
        ].map(k => (
          <div key={k.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs text-zinc-500 uppercase tracking-wide">{k.label}</p>
              <k.icon size={18} className={k.cor} />
            </div>
            <p className={`font-rajdhani font-bold text-3xl ${k.cor}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Abas de filtro */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {abas.map(a => (
          <Link
            key={a.key}
            href={`/admin/clientes?categoria=${a.key}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              categoria === a.key
                ? 'bg-vermelho text-white'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <a.icon size={14} />
            {a.label}
            <span className="bg-zinc-800 text-zinc-400 text-xs px-1.5 py-0.5 rounded-full">{a.count}</span>
          </Link>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950">
              <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Origem</th>
                <th className="text-left px-5 py-3">Pedidos</th>
                <th className="text-left px-5 py-3">Total gasto</th>
                <th className="text-left px-5 py-3">Serviços</th>
                <th className="text-left px-5 py-3">Funil</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-zinc-600 text-sm">
                    Nenhum cliente encontrado
                  </td>
                </tr>
              )}
              {clientes.map(c => (
                <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{c.nome ?? '—'}</div>
                    <div className="text-xs text-zinc-600">{c.email}</div>
                    {c.telefone && <div className="text-xs text-zinc-600">{c.telefone}</div>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ORIGEM_COR[c.origem]}`}>
                      {ORIGEM_LABEL[c.origem]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{c.orders.length}</td>
                  <td className="px-5 py-3 text-white font-medium">
                    {formatPrice(Number(c.crm?.totalGasto ?? 0))}
                  </td>
                  <td className="px-5 py-3 text-zinc-400">
                    {c.appointments.length > 0
                      ? `${c.crm?.totalServicos ?? c.appointments.length}x`
                      : <span className="text-zinc-700">—</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${FUNIL_COR[c.crm?.etapaFunil ?? 'LEAD']}`}>
                      {c.crm?.etapaFunil ?? 'LEAD'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/clientes/${c.id}`} className="text-xs text-zinc-500 hover:text-white transition-colors">
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
