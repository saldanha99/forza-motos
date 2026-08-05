export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {
  AlertTriangle, ArrowUpRight, CalendarClock, CheckCircle2, CloudOff,
  DollarSign, MessageCircleWarning, Package, ShoppingBag, Users,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice, cn } from '@/lib/utils'
import { KpiCard } from '@/components/admin/KpiCard'
import { FadeIn } from '@/components/admin/FadeIn'
import {
  Card, CardHeader, EmptyState, PageHeader, SectionTitle, StatusPill,
  TD_CELULA, THEAD_TH, TR_LINHA,
} from '@/components/admin/ui/primitives'
import { COLUNAS_PEDIDO } from '@/lib/admin/kanban'

export const metadata = { title: 'Dashboard — Forza Admin' }

const DIA = 24 * 60 * 60 * 1000

/* ═══════════════════════════════════════════════════════════════════
   Card de pendência — verde quando não há nada a fazer
   ═══════════════════════════════════════════════════════════════════ */

function CardAcao({
  quantidade, label, tudoCerto, href, icone: Icone, urgente = false,
}: {
  quantidade: number
  /** O que fazer, quando há pendência. */
  label: string
  /** O que dizer quando está tudo em dia. */
  tudoCerto: string
  href: string
  icone: typeof ShoppingBag
  urgente?: boolean
}) {
  const precisaAcao = quantidade > 0
  const tom = urgente ? 'danger' : 'warning'

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition hover:-translate-y-0.5',
        precisaAcao
          ? tom === 'danger'
            ? 'border-brand-danger bg-brand-danger-soft'
            : 'border-brand-warning bg-brand-warning-soft'
          : 'border-brand-border bg-brand-surface',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
          precisaAcao
            ? tom === 'danger'
              ? 'text-brand-danger'
              : 'text-brand-warning'
            : 'bg-brand-success-soft text-brand-success',
        )}
      >
        {precisaAcao ? <Icone size={20} /> : <CheckCircle2 size={20} />}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'font-barlow text-xl font-black leading-none tabular-nums',
            precisaAcao
              ? tom === 'danger'
                ? 'text-brand-danger'
                : 'text-brand-warning'
              : 'text-brand-success',
          )}
        >
          {precisaAcao ? quantidade : 'OK'}
        </p>
        <p className="mt-1 truncate text-xs text-brand-muted">
          {precisaAcao ? label : tudoCerto}
        </p>
      </div>

      <ArrowUpRight
        size={15}
        className="shrink-0 text-brand-dim opacity-0 transition-opacity group-hover:opacity-100"
      />
    </Link>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Pipeline — o funil de pedidos em uma linha, clicável
   ═══════════════════════════════════════════════════════════════════ */

function Pipeline({ contagens }: { contagens: Record<string, number> }) {
  const etapas = COLUNAS_PEDIDO.filter((c) => c.id !== 'CANCELADO')
  const total = etapas.reduce((s, e) => s + (contagens[e.id] ?? 0), 0)

  const BARRA: Record<string, string> = {
    warning: 'bg-brand-warning',
    danger:  'bg-brand-danger',
    info:    'bg-brand-info',
    success: 'bg-brand-success',
    neutro:  'bg-brand-dim',
    accent:  'bg-brand-accent',
  }

  return (
    <Card className="p-5">
      <SectionTitle
        acao={
          <Link
            href="/admin/pedidos"
            className="text-xs font-semibold text-brand-accent hover:underline"
          >
            Abrir quadro →
          </Link>
        }
      >
        Pipeline de pedidos
      </SectionTitle>

      {total === 0 ? (
        <p className="py-4 text-sm text-brand-muted">
          Nenhum pedido em movimento no momento.
        </p>
      ) : (
        <>
          {/* Barra proporcional: dá pra ver onde o fluxo está entupido */}
          <div className="mb-4 flex h-2 gap-0.5 overflow-hidden rounded-full bg-brand-elevated">
            {etapas.map((e) => {
              const n = contagens[e.id] ?? 0
              if (n === 0) return null
              return (
                <span
                  key={e.id}
                  title={`${e.titulo}: ${n}`}
                  className={BARRA[e.tom]}
                  style={{ width: `${(n / total) * 100}%` }}
                />
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {etapas.map((e) => (
              <Link
                key={e.id}
                href={`/admin/pedidos?vista=lista&status=${e.id}`}
                className="rounded-xl border border-brand-border bg-brand-surface-2 px-3 py-2.5 transition-colors hover:border-brand-accent"
              >
                <span className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', BARRA[e.tom])} />
                  <span className="font-barlow text-lg font-bold tabular-nums text-brand-text">
                    {contagens[e.id] ?? 0}
                  </span>
                </span>
                <p className="mt-0.5 truncate text-[11px] leading-tight text-brand-muted">
                  {e.titulo}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Página
   ═══════════════════════════════════════════════════════════════════ */

export default async function DashboardPage() {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const ontem = new Date(hoje.getTime() - DIA)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const inicioMesPassado = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const seteAtras = new Date(Date.now() - 7 * DIA)

  const [
    pedidosHoje, pedidosOntem,
    receitaMes, receitaMesPassado,
    clientesNovos, estoqueCritico,
    ultimosPedidos, porStatus,
    aDespachar, replicacaoFalhou, agendamentosPendentes, whatsappFalhas,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: hoje }, status: { not: 'CANCELADO' } } }),
    prisma.order.count({ where: { createdAt: { gte: ontem, lt: hoje }, status: { not: 'CANCELADO' } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: inicioMes }, status: { not: 'CANCELADO' } },
      _sum: { total: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: inicioMesPassado, lt: inicioMes }, status: { not: 'CANCELADO' } },
      _sum: { total: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: inicioMes } } }),
    prisma.product.count({ where: { estoque: { lt: 5 }, ativo: true } }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { user: true, items: { select: { id: true } } },
    }),
    prisma.order.groupBy({ by: ['status'], _count: true }),
    prisma.order.count({ where: { status: { in: ['CONFIRMADO', 'SEPARANDO'] } } }),
    prisma.order.count({ where: { status: 'CONFIRMADO', olistOrderId: null } }),
    prisma.appointment.count({ where: { status: 'pendente', dataPreferida: { gte: hoje } } }),
    prisma.crmMensagem.count({ where: { status: 'FALHA', updatedAt: { gte: seteAtras } } }),
  ])

  const receita = Number(receitaMes._sum.total ?? 0)
  const receitaAnterior = Number(receitaMesPassado._sum.total ?? 0)

  /** Variação só faz sentido com base de comparação — senão não mostramos nada. */
  function variacao(atual: number, anterior: number) {
    if (!anterior) return undefined
    return { value: Math.round(((atual - anterior) / anterior) * 100) }
  }

  const contagens = Object.fromEntries(porStatus.map((s) => [s.status, s._count]))
  const totalPendencias = replicacaoFalhou + aDespachar + agendamentosPendentes + whatsappFalhas

  return (
    <div>
      <PageHeader
        titulo="Dashboard"
        descricao={
          totalPendencias > 0
            ? `${totalPendencias} ${totalPendencias === 1 ? 'item precisa' : 'itens precisam'} da sua atenção agora.`
            : 'Nenhuma pendência aberta — a operação está em dia.'
        }
      />

      {/* Precisa de ação — sempre no topo, é o motivo de abrir o painel */}
      <FadeIn delay={0} className="mb-8">
        <SectionTitle>Precisa de você agora</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <CardAcao
            quantidade={replicacaoFalhou}
            urgente
            label="pagos e não replicados no Olist"
            tudoCerto="Todos os pagos estão no Olist"
            href="/admin/pedidos?vista=lista&status=CONFIRMADO"
            icone={CloudOff}
          />
          <CardAcao
            quantidade={aDespachar}
            label="pedidos aguardando despacho"
            tudoCerto="Nenhum pedido esperando despacho"
            href="/admin/pedidos"
            icone={ShoppingBag}
          />
          <CardAcao
            quantidade={agendamentosPendentes}
            label="agendamentos a confirmar"
            tudoCerto="Agendamentos em dia"
            href="/admin/agendamentos"
            icone={CalendarClock}
          />
          <CardAcao
            quantidade={whatsappFalhas}
            label="mensagens de WhatsApp com falha (7d)"
            tudoCerto="WhatsApp entregando normalmente"
            href="/admin/crm"
            icone={MessageCircleWarning}
          />
        </div>
      </FadeIn>

      {/* Números do período */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FadeIn delay={0}>
          <KpiCard
            label="Pedidos hoje"
            value={pedidosHoje}
            icon={ShoppingBag}
            tom="accent"
            trend={variacao(pedidosHoje, pedidosOntem)}
            detalhe={pedidosOntem ? `${pedidosOntem} ontem` : 'sem base de ontem'}
            href="/admin/pedidos"
          />
        </FadeIn>
        <FadeIn delay={80}>
          <KpiCard
            label="Receita do mês"
            value={receita}
            icon={DollarSign}
            tom="success"
            prefix="R$ "
            decimals={2}
            trend={variacao(receita, receitaAnterior)}
            detalhe={receitaAnterior ? 'vs. mês passado' : undefined}
          />
        </FadeIn>
        <FadeIn delay={160}>
          <KpiCard
            label="Clientes novos"
            value={clientesNovos}
            icon={Users}
            tom="info"
            detalhe="cadastrados neste mês"
            href="/admin/clientes"
          />
        </FadeIn>
        <FadeIn delay={240}>
          <KpiCard
            label="Estoque crítico"
            value={estoqueCritico}
            icon={AlertTriangle}
            tom={estoqueCritico > 0 ? 'warning' : 'success'}
            detalhe="ativos com menos de 5 unidades"
            href="/admin/produtos"
          />
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <FadeIn delay={320} className="xl:col-span-2">
          <Pipeline contagens={contagens} />
        </FadeIn>

        <FadeIn delay={400} className="xl:col-span-3">
          <Card className="overflow-hidden">
            <CardHeader
              titulo="Últimos pedidos"
              acao={
                <Link
                  href="/admin/pedidos"
                  className="text-xs font-semibold text-brand-accent hover:underline"
                >
                  Ver todos →
                </Link>
              }
            />
            {ultimosPedidos.length === 0 ? (
              <EmptyState
                compacto
                icone={Package}
                titulo="Nenhum pedido ainda"
                descricao="A primeira compra fechada na loja aparece aqui."
                className="m-4 border-0"
              />
            ) : (
              <div className="admin-scroll overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-brand-hair bg-brand-surface-2">
                    <tr className="text-[11px] uppercase tracking-[0.12em] text-brand-dim">
                      <th className={THEAD_TH}>Pedido</th>
                      <th className={THEAD_TH}>Cliente</th>
                      <th className={THEAD_TH}>Total</th>
                      <th className={THEAD_TH}>Etapa</th>
                      <th className={THEAD_TH}>Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ultimosPedidos.map((p) => (
                      <tr key={p.id} className={TR_LINHA}>
                        <td className={TD_CELULA}>
                          <Link
                            href={`/admin/pedidos/${p.id}`}
                            className="font-semibold text-brand-accent hover:underline"
                          >
                            {p.orderNumber}
                          </Link>
                        </td>
                        <td className={cn(TD_CELULA, 'text-brand-muted')}>
                          {p.user?.nome ?? p.user?.email ?? 'Visitante'}
                        </td>
                        <td className={cn(TD_CELULA, 'font-semibold tabular-nums text-brand-text')}>
                          {formatPrice(Number(p.total))}
                        </td>
                        <td className={TD_CELULA}>
                          <StatusPill status={p.status} />
                        </td>
                        <td className={cn(TD_CELULA, 'text-brand-muted')}>
                          {formatDate(p.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
