import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
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
      <h1 className="font-rajdhani font-bold text-4xl text-white mb-2 uppercase tracking-wide">
        Minha Conta
      </h1>
      <p className="text-zinc-500 mb-10">Olá, {user?.nome ?? session.user.name ?? 'visitante'}!</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Dados pessoais */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Dados pessoais</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-zinc-600 text-xs">Nome</dt>
                <dd className="text-white">{user?.nome ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-zinc-600 text-xs">E-mail</dt>
                <dd className="text-white">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-zinc-600 text-xs">Telefone</dt>
                <dd className="text-white">{user?.telefone ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-zinc-600 text-xs">CPF</dt>
                <dd className="text-white">{user?.cpf ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-zinc-600 text-xs">Membro desde</dt>
                <dd className="text-white">{formatDate(user!.createdAt)}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Pedidos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Meus pedidos</h2>
            {pedidos.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum pedido realizado ainda.</p>
            ) : (
              <div className="space-y-3">
                {pedidos.map((p) => (
                  <Link key={p.id} href={`/rastrear?pedido=${p.orderNumber}`}>
                    <div className="border border-zinc-800 hover:border-zinc-600 rounded-lg p-4 transition-colors">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <p className="font-medium text-white text-sm">{p.orderNumber}</p>
                          <p className="text-xs text-zinc-600">{formatDate(p.createdAt)} · {p.items.length} item(s)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {statusBadge(p.status)}
                          <span className="font-bold text-white text-sm">{formatPrice(Number(p.total))}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Agendamentos */}
          {agendamentos.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h2 className="font-rajdhani font-semibold text-lg text-white mb-4">Meus agendamentos</h2>
              <div className="space-y-3">
                {agendamentos.map((a) => (
                  <div key={a.id} className="border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-medium text-white text-sm">{a.servico}</p>
                        <p className="text-xs text-zinc-600">{a.motoModelo} · {formatDate(a.dataPreferida)} às {a.horarioPreferido}</p>
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
