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
      <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight mb-2">
        {cliente.nome ?? 'Cliente'}
      </h1>
      <p className="text-brand-muted text-sm mb-8">{cliente.email}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Pedidos */}
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
            <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Pedidos</h2>
            {cliente.orders.length === 0 ? (
              <p className="text-sm text-brand-muted/70">Nenhum pedido realizado.</p>
            ) : (
              <div className="space-y-3">
                {cliente.orders.map((p) => (
                  <Link key={p.id} href={`/admin/pedidos/${p.id}`} className="block group">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:border-brand-accent hover:bg-white/[0.08] transition-all duration-200">
                      <div>
                        <p className="text-sm font-semibold text-brand-accent group-hover:text-brand-accent-hover transition-colors">{p.orderNumber}</p>
                        <p className="text-xs text-brand-muted mt-0.5">{formatDate(p.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {statusBadge(p.status)}
                        <span className="font-bold text-brand-text text-sm">{formatPrice(Number(p.total))}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Agendamentos */}
          {cliente.appointments.length > 0 && (
            <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-6 shadow-xl transition-all duration-300 hover:border-brand-accent/30">
              <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Agendamentos</h2>
              <div className="space-y-3">
                {cliente.appointments.map((a) => (
                  <div key={a.id} className="p-4 rounded-xl border border-white/10 bg-white/5 text-sm">
                    <p className="text-brand-text font-semibold">{a.servico}</p>
                    <p className="text-brand-muted text-xs mt-1">{a.motoModelo} · {formatDate(a.dataPreferida)} às {a.horarioPreferido}</p>
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
