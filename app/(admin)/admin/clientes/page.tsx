export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatPrice, cn } from '@/lib/utils'
import Link from 'next/link'
import { KpiCard } from '@/components/admin/KpiCard'
import { FadeIn } from '@/components/admin/FadeIn'
import { ShoppingBag, Wrench, Users, TrendingUp } from 'lucide-react'
import type { TomStatus } from '@/lib/admin/status'
import {
  PageHeader, FilterChip, Tabela, EmptyState, Badge,
  THEAD_TH, TR_LINHA, TD_CELULA,
} from '@/components/admin/ui/primitives'

export const metadata = { title: 'CRM — Forza Admin' }

const FUNIL_TOM: Record<string, TomStatus> = {
  LEAD:       'neutro',
  ORCAMENTO:  'info',
  FECHADO:    'success',
  RECORRENTE: 'accent',
}

const ORIGEM_TOM: Record<string, TomStatus> = {
  ECOMMERCE:    'info',
  MERCADOLIVRE: 'warning',
  AGENDAMENTO:  'accent',
  MANUAL:       'neutro',
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
      <PageHeader
        titulo="CRM Inteligente"
        descricao="Clientes que compraram na loja ou agendaram um serviço — o cadastro do Mercado Livre não entra aqui."
      />

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
      <div className="mb-6 flex flex-wrap gap-2">
        {abas.map(a => (
          <FilterChip
            key={a.key}
            href={`/admin/clientes?categoria=${a.key}`}
            ativo={categoria === a.key}
            contagem={a.count}
          >
            <a.icon size={14} />
            {a.label}
          </FilterChip>
        ))}
      </div>

      {/* Tabela */}
      {clientes.length === 0 ? (
        <EmptyState
          icone={Users}
          titulo="Nenhum cliente encontrado"
          descricao="Um cliente aparece aqui assim que compra algo na loja ou agenda um serviço no box — cadastros vindos só do Mercado Livre ficam fora do CRM."
        />
      ) : (
        <Tabela
          rodape={<span>{clientes.length} cliente(s)</span>}
          cabecalho={
            <>
              <th className={THEAD_TH}>Cliente</th>
              <th className={THEAD_TH}>Origem</th>
              <th className={THEAD_TH}>Pedidos</th>
              <th className={THEAD_TH}>Total gasto</th>
              <th className={THEAD_TH}>Serviços</th>
              <th className={THEAD_TH}>Funil</th>
              <th className={THEAD_TH} />
            </>
          }
        >
          {clientes.map(c => (
            <tr key={c.id} className={TR_LINHA}>
              <td className={TD_CELULA}>
                <div className="font-medium text-brand-text">{c.nome ?? '—'}</div>
                <div className="text-xs text-brand-muted">{c.email}</div>
                {c.telefone && <div className="text-xs text-brand-muted">{c.telefone}</div>}
              </td>
              <td className={TD_CELULA}>
                <Badge tom={ORIGEM_TOM[c.origem]}>{ORIGEM_LABEL[c.origem]}</Badge>
              </td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>{c.orders.length}</td>
              <td className={cn(TD_CELULA, 'font-semibold text-brand-text')}>
                {formatPrice(Number(c.crm?.totalGasto ?? 0))}
              </td>
              <td className={cn(TD_CELULA, 'text-brand-muted')}>
                {c.appointments.length > 0
                  ? `${c.crm?.totalServicos ?? c.appointments.length}x`
                  : <span className="text-brand-dim">—</span>
                }
              </td>
              <td className={TD_CELULA}>
                <Badge tom={FUNIL_TOM[c.crm?.etapaFunil ?? 'LEAD']}>{c.crm?.etapaFunil ?? 'LEAD'}</Badge>
              </td>
              <td className={TD_CELULA}>
                <Link href={`/admin/clientes/${c.id}`} className="text-xs text-brand-dim transition-colors hover:text-brand-accent">
                  Ver →
                </Link>
              </td>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  )
}
