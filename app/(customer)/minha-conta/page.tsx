import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { ProfileEditForm } from '@/components/store/ProfileEditForm'
import Link from 'next/link'

export const metadata = { title: 'Minha Conta' }

export default async function MinhaContaPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login?callbackUrl=/minha-conta')

  const [user, pedidos, agendamentos] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { items: { include: { product: true } } },
    }),
    prisma.appointment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ])

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-grotesk font-bold text-3xl text-ink mb-1">Minha Conta</h1>
        <p className="text-dim">Olá, {user?.nome ?? session.user.name ?? 'visitante'}!</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados pessoais */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-line rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-4">Dados pessoais</h2>
            <dl className="space-y-3 text-sm">
              {[
                { label: 'Nome', value: user?.nome ?? '-' },
                { label: 'E-mail', value: user?.email },
                { label: 'Telefone', value: user?.telefone ?? '-' },
                { label: 'CPF', value: user?.cpf ?? '-' },
                { label: 'Membro desde', value: formatDate(user!.createdAt) },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-faint">{item.label}</dt>
                  <dd className="text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
            <ProfileEditForm
              nome={user?.nome}
              telefone={user?.telefone}
              cpf={user?.cpf}
            />
          </div>
        </div>

        {/* Pedidos e Agendamentos */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-line rounded-xl p-5">
            <h2 className="font-grotesk font-semibold text-base text-ink mb-4">Meus pedidos</h2>
            {pedidos.length === 0 ? (
              <p className="text-sm text-dim">Nenhum pedido realizado ainda.</p>
            ) : (
              <div className="space-y-2">
                {pedidos.map((p) => (
                  <Link key={p.id} href={`/rastrear?pedido=${p.orderNumber}`}>
                    <div className="border border-line hover:border-line-hi rounded-xl p-4 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium text-ink text-sm font-mono">{p.orderNumber}</p>
                          <p className="text-xs text-faint">{formatDate(p.createdAt)} · {p.items.length} item(s)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {statusBadge(p.status)}
                          <span className="font-bold text-ink text-sm">{formatPrice(Number(p.total))}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {agendamentos.length > 0 && (
            <div className="bg-card border border-line rounded-xl p-5">
              <h2 className="font-grotesk font-semibold text-base text-ink mb-4">Meus agendamentos</h2>
              <div className="space-y-2">
                {agendamentos.map((a) => (
                  <div key={a.id} className="border border-line rounded-xl p-4">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-medium text-ink text-sm">{a.servico}</p>
                        <p className="text-xs text-faint">{a.motoModelo} · {formatDate(a.dataPreferida)} às {a.horarioPreferido}</p>
                      </div>
                      {statusBadge(a.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
