import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import Link from 'next/link'

const FUNIL_COR: Record<string, string> = {
  LEAD: 'bg-zinc-800 text-zinc-400',
  ORCAMENTO: 'bg-blue-900/50 text-blue-400 border border-blue-800',
  FECHADO: 'bg-green-900/50 text-green-400 border border-green-800',
  RECORRENTE: 'bg-purple-900/50 text-purple-400 border border-purple-800',
}

export const metadata = { title: 'CRM Clientes' }

export default async function ClientesAdminPage() {
  const clientes = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    include: {
      crm: true,
      orders: { where: { status: { not: 'CANCELADO' } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const funis = ['LEAD', 'ORCAMENTO', 'FECHADO', 'RECORRENTE']

  return (
    <div>
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-8">CRM Clientes</h1>

      {/* Kanban funil resumido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {funis.map((f) => {
          const count = clientes.filter((c) => (c.crm?.etapaFunil ?? 'LEAD') === f).length
          return (
            <div key={f} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-white mb-1">{count}</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${FUNIL_COR[f]}`}>
                {f}
              </span>
            </div>
          )
        })}
      </div>

      {/* Tabela */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950">
              <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Cliente</th>
                <th className="text-left px-5 py-3">Pedidos</th>
                <th className="text-left px-5 py-3">Total gasto</th>
                <th className="text-left px-5 py-3">Última compra</th>
                <th className="text-left px-5 py-3">Funil</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{c.nome ?? '-'}</div>
                    <div className="text-xs text-zinc-600">{c.email}</div>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{c.orders.length}</td>
                  <td className="px-5 py-3 text-white">
                    {formatPrice(Number(c.crm?.totalGasto ?? 0))}
                  </td>
                  <td className="px-5 py-3 text-zinc-500">
                    {c.crm?.ultimaCompra ? formatDate(c.crm.ultimaCompra) : '-'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${FUNIL_COR[c.crm?.etapaFunil ?? 'LEAD']}`}>
                      {c.crm?.etapaFunil ?? 'LEAD'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/clientes/${c.id}`} className="text-xs text-zinc-500 hover:text-white">
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
