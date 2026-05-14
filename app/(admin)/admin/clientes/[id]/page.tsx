export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate, formatPrice } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { ClienteCRMForm } from '@/components/admin/ClienteCRMForm'
import Link from 'next/link'

export default async function ClienteDetalhePage({ params }: { params: { id: string } }) {
  const cliente = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      crm: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        include: { items: true },
      },
      appointments: { orderBy: { createdAt: 'desc' } },
    },
  })

  if (!cliente) notFound()

  return (
    <div className="max-w-4xl">
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-2">
        {cliente.nome ?? 'Cliente'}
      </h1>
      <p className="text-zinc-500 text-sm mb-8">{cliente.email}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pedidos */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Pedidos</h2>
            {cliente.orders.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum pedido.</p>
            ) : (
              <div className="space-y-2">
                {cliente.orders.map((p) => (
                  <Link key={p.id} href={`/admin/pedidos/${p.id}`}>
                    <div className="flex items-center justify-between p-3 rounded border border-zinc-800 hover:border-zinc-600 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-vermelho">{p.orderNumber}</p>
                        <p className="text-xs text-zinc-600">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {statusBadge(p.status)}
                        <span className="font-bold text-white text-sm">{formatPrice(Number(p.total))}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Agendamentos */}
          {cliente.appointments.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Agendamentos</h2>
              <div className="space-y-2">
                {cliente.appointments.map((a) => (
                  <div key={a.id} className="p-3 rounded border border-zinc-800 text-sm">
                    <p className="text-white font-medium">{a.servico}</p>
                    <p className="text-zinc-500 text-xs">{a.motoModelo} · {formatDate(a.dataPreferida)} às {a.horarioPreferido}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CRM lateral */}
        <div>
          <ClienteCRMForm userId={cliente.id} crm={cliente.crm as any} />
        </div>
      </div>
    </div>
  )
}
