export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { KanbanSquare, Rows3 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { STATUS_PEDIDO } from '@/lib/admin/status'
import {
  PageHeader, StatusPill, Tabela, FilterChip, EmptyState,
  THEAD_TH, TR_LINHA, TD_CELULA,
} from '@/components/admin/ui/primitives'
import { PedidosKanban, type PedidoKanban } from '@/components/admin/kanban/PedidosKanban'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Pedidos — Forza Admin' }

const STATUS_OPTIONS = ['TODOS', ...Object.keys(STATUS_PEDIDO)]
const POR_PAGINA = 25

/** No quadro só entra o que ainda dá trabalho — o histórico fica na lista. */
const JANELA_QUADRO_DIAS = 45

function AlternadorVista({ vista }: { vista: 'quadro' | 'lista' }) {
  const opcoes = [
    { id: 'quadro', label: 'Quadro', icone: KanbanSquare },
    { id: 'lista',  label: 'Lista',  icone: Rows3 },
  ] as const

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-brand-border bg-brand-surface-2 p-0.5">
      {opcoes.map((o) => (
        <Link
          key={o.id}
          href={`/admin/pedidos?vista=${o.id}`}
          aria-current={vista === o.id ? 'page' : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
            vista === o.id
              ? 'bg-brand-accent text-brand-on-accent shadow-cta'
              : 'text-brand-muted hover:text-brand-text',
          )}
        >
          <o.icone size={13} />
          {o.label}
        </Link>
      ))}
    </div>
  )
}

export default async function PedidosAdminPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string; vista?: string }
}) {
  const vista = searchParams.vista === 'lista' ? 'lista' : 'quadro'

  /* ── Quadro ───────────────────────────────────────────────────── */
  if (vista === 'quadro') {
    const desde = new Date(Date.now() - JANELA_QUADRO_DIAS * 24 * 60 * 60 * 1000)

    const pedidos = await prisma.order.findMany({
      where: {
        OR: [
          // Tudo que ainda está em movimento, independente da data
          { status: { in: ['AGUARDANDO_PAGAMENTO', 'CONFIRMADO', 'SEPARANDO', 'ENVIADO'] } },
          // Fechados só se recentes, para dar contexto sem inflar o quadro
          { status: { in: ['ENTREGUE', 'CANCELADO'] }, createdAt: { gte: desde } },
        ],
      },
      orderBy: { createdAt: 'asc' }, // FIFO: o mais antigo é o mais urgente
      include: { user: true, items: { select: { id: true } } },
      take: 300,
    })

    const itens: PedidoKanban[] = pedidos.map((p) => ({
      id: p.id,
      coluna: p.status,
      rotulo: `Pedido ${p.orderNumber}`,
      valor: Number(p.total),
      numero: p.orderNumber,
      cliente: p.user?.nome ?? p.user?.email ?? 'Visitante',
      itens: p.items.length,
      total: Number(p.total),
      criadoEm: formatDate(p.createdAt),
      retirada: p.freteServico === 'retirada',
      semOlist: p.status === 'CONFIRMADO' && !p.olistOrderId,
    }))

    return (
      <div>
        <PageHeader
          titulo="Pedidos"
          descricao="Arraste o card pela alça para mudar a etapa — o cliente é notificado automaticamente. No celular, use “Mover para…”."
          acoes={<AlternadorVista vista="quadro" />}
        />

        {itens.length === 0 ? (
          <EmptyState
            titulo="Nenhum pedido em aberto"
            descricao="Quando alguém fechar uma compra na loja, o pedido aparece aqui na primeira coluna."
          />
        ) : (
          <PedidosKanban pedidos={itens} />
        )}
      </div>
    )
  }

  /* ── Lista ────────────────────────────────────────────────────── */
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const where: any = {}
  if (searchParams.status && searchParams.status !== 'TODOS') where.status = searchParams.status

  const [pedidos, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { user: true, items: { select: { id: true } } },
    }),
    prisma.order.count({ where }),
  ])

  const pages = Math.ceil(total / POR_PAGINA)
  const statusAtivo = searchParams.status ?? 'TODOS'

  return (
    <div>
      <PageHeader
        titulo="Pedidos"
        descricao="Histórico completo, com filtro por etapa e paginação."
        acoes={<AlternadorVista vista="lista" />}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((s) => (
          <FilterChip
            key={s}
            href={`/admin/pedidos?vista=lista&status=${s}`}
            ativo={statusAtivo === s}
          >
            {s === 'TODOS' ? 'Todos' : STATUS_PEDIDO[s].label}
          </FilterChip>
        ))}
      </div>

      <Tabela
        cabecalho={
          <>
            <th className={THEAD_TH}>Pedido</th>
            <th className={THEAD_TH}>Cliente</th>
            <th className={THEAD_TH}>Itens</th>
            <th className={THEAD_TH}>Total</th>
            <th className={THEAD_TH}>Etapa</th>
            <th className={THEAD_TH}>Data</th>
            <th className={THEAD_TH} />
          </>
        }
        rodape={
          <>
            <span>{total} pedido(s)</span>
            {pages > 1 && (
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <Link
                    key={p}
                    href={`/admin/pedidos?vista=lista&status=${statusAtivo}&page=${p}`}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-all',
                      p === page
                        ? 'bg-brand-accent text-brand-on-accent'
                        : 'border border-brand-border text-brand-muted hover:text-brand-text',
                    )}
                  >
                    {p}
                  </Link>
                ))}
              </div>
            )}
          </>
        }
      >
        {pedidos.map((p) => (
          <tr key={p.id} className={TR_LINHA}>
            <td className={TD_CELULA}>
              <Link
                href={`/admin/pedidos/${p.id}`}
                className="font-semibold text-brand-accent hover:underline"
              >
                {p.orderNumber}
              </Link>
            </td>
            <td className={TD_CELULA}>
              <div className="text-brand-text">{p.user?.nome ?? 'Visitante'}</div>
              <div className="text-xs text-brand-dim">{p.user?.email}</div>
            </td>
            <td className={cn(TD_CELULA, 'tabular-nums text-brand-muted')}>{p.items.length}</td>
            <td className={cn(TD_CELULA, 'font-semibold tabular-nums text-brand-text')}>
              {formatPrice(Number(p.total))}
            </td>
            <td className={TD_CELULA}>
              <StatusPill status={p.status} />
            </td>
            <td className={cn(TD_CELULA, 'text-brand-muted')}>{formatDate(p.createdAt)}</td>
            <td className={TD_CELULA}>
              <Link
                href={`/admin/pedidos/${p.id}`}
                className="text-xs text-brand-dim transition-colors hover:text-brand-accent"
              >
                Ver →
              </Link>
            </td>
          </tr>
        ))}
      </Tabela>
    </div>
  )
}
