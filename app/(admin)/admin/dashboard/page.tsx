export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatPrice, formatDate } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { KpiCard } from '@/components/admin/KpiCard'
import { FadeIn } from '@/components/admin/FadeIn'
import Link from 'next/link'
import {
  ShoppingBag, DollarSign, Users, AlertTriangle,
  CloudOff, CalendarClock, MessageCircleWarning, CheckCircle2,
} from 'lucide-react'

export const metadata = { title: 'Dashboard — Forza Admin' }

/** Card acionável: vermelho/âmbar quando exige ação, verde quando está tudo ok */
function ActionCard({
  count, label, ok, href, icon: Icon, urgente = false,
}: {
  count: number; label: string; ok: string; href: string; icon: any; urgente?: boolean
}) {
  const precisaAcao = count > 0
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-200 hover:scale-[1.02] ${
        precisaAcao
          ? urgente
            ? 'bg-red-500/10 border-red-500/40 hover:border-red-400'
            : 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400'
          : 'bg-emerald-500/[0.06] border-emerald-500/20 hover:border-emerald-500/40'
      }`}
    >
      {precisaAcao ? (
        <Icon size={22} className={urgente ? 'text-red-400' : 'text-amber-400'} />
      ) : (
        <CheckCircle2 size={22} className="text-emerald-500/70" />
      )}
      <div className="min-w-0">
        <p className={`font-barlow font-black text-xl leading-none ${
          precisaAcao ? (urgente ? 'text-red-300' : 'text-amber-300') : 'text-emerald-400/80'
        }`}>
          {precisaAcao ? count : '✓'}
        </p>
        <p className="text-xs text-brand-muted mt-1 truncate">{precisaAcao ? label : ok}</p>
      </div>
    </Link>
  )
}

export default async function DashboardPage() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const seteAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    pedidosHoje,
    receitaMes,
    clientesNovos,
    produtosBaixoEstoque,
    ultimosPedidos,
    // "Precisa de ação"
    aDespachar,
    replicacaoFalhou,
    agendamentosPendentes,
    whatsappFalhas,
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
    // Pedidos pagos aguardando separação/despacho
    prisma.order.count({ where: { status: { in: ['CONFIRMADO', 'SEPARANDO'] } } }),
    // Pagos que NÃO chegaram ao Olist (sem NF nem baixa de estoque no ERP!)
    prisma.order.count({ where: { status: 'CONFIRMADO', olistOrderId: null } }),
    // Agendamentos aguardando confirmação
    prisma.appointment.count({ where: { status: 'pendente', dataPreferida: { gte: hoje } } }),
    // Mensagens WhatsApp que falharam nos últimos 7 dias
    prisma.crmMensagem.count({ where: { status: 'FALHA', updatedAt: { gte: seteAtras } } }),
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

      {/* Precisa de ação */}
      <FadeIn delay={0} className="mb-8">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted/70 mb-2">
          Precisa de ação
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            count={replicacaoFalhou}
            urgente
            label="pedidos pagos SEM replicar no Olist"
            ok="Todos os pagos estão no Olist"
            href="/admin/pedidos?filtro=sem-olist"
            icon={CloudOff}
          />
          <ActionCard
            count={aDespachar}
            label="pedidos aguardando despacho"
            ok="Nenhum pedido esperando despacho"
            href="/admin/pedidos"
            icon={ShoppingBag}
          />
          <ActionCard
            count={agendamentosPendentes}
            label="agendamentos p/ confirmar"
            ok="Agendamentos em dia"
            href="/admin/agendamentos"
            icon={CalendarClock}
          />
          <ActionCard
            count={whatsappFalhas}
            label="WhatsApp com falha (7d)"
            ok="WhatsApp 100% entregue"
            href="/admin/crm"
            icon={MessageCircleWarning}
          />
        </div>
      </FadeIn>

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
