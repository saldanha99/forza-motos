export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { formatDate, formatPrice } from '@/lib/utils'
import { ClienteCRMForm } from '@/components/admin/ClienteCRMForm'
import Link from 'next/link'
import {
  Card, CardHeader, EmptyState, PageHeader, StatusPill,
} from '@/components/admin/ui/primitives'

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
      <PageHeader titulo={cliente.nome ?? 'Cliente'} descricao={cliente.email} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pedidos */}
          <Card>
            <CardHeader titulo="Pedidos" />
            <div className="p-5">
              {cliente.orders.length === 0 ? (
                <EmptyState
                  compacto
                  titulo="Nenhum pedido realizado"
                  descricao="Um pedido aparece aqui assim que o cliente fecha uma compra na loja."
                  className="border-0 py-4"
                />
              ) : (
                <div className="space-y-3">
                  {cliente.orders.map((p) => (
                    <Link key={p.id} href={`/admin/pedidos/${p.id}`} className="block group">
                      <div className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface-2 p-4 transition duration-200 hover:border-brand-accent hover:bg-brand-elevated">
                        <div>
                          <p className="text-sm font-semibold text-brand-accent transition-colors group-hover:text-brand-accent-hover">{p.orderNumber}</p>
                          <p className="mt-0.5 text-xs text-brand-muted">{formatDate(p.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <StatusPill status={p.status} />
                          <span className="text-sm font-bold text-brand-text">{formatPrice(Number(p.total))}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Agendamentos */}
          {cliente.appointments.length > 0 && (
            <Card>
              <CardHeader titulo="Agendamentos" />
              <div className="space-y-3 p-5">
                {cliente.appointments.map((a) => (
                  <div key={a.id} className="rounded-xl border border-brand-border bg-brand-surface-2 p-4 text-sm">
                    <p className="font-semibold text-brand-text">{a.servico}</p>
                    <p className="mt-1 text-xs text-brand-muted">{a.motoModelo} · {formatDate(a.dataPreferida)} às {a.horarioPreferido}</p>
                  </div>
                ))}
              </div>
            </Card>
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
