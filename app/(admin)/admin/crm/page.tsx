export const dynamic = 'force-dynamic'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  KanbanSquare, Rows3, Users, MessageCircle, CheckCircle2, Clock, AlertCircle, TrendingUp,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { WhatsAppConnect } from '@/components/admin/WhatsAppConnect'
import { LeadsKanban, type LeadKanban } from '@/components/admin/kanban/LeadsKanban'
import {
  PageHeader, StatusPill, EmptyState, Card, TOM_FUNDO, TOM_TEXTO,
} from '@/components/admin/ui/primitives'
import type { TomStatus } from '@/lib/admin/status'

export const metadata = { title: 'Funil de leads — Forza Admin' }

/** Só entram no funil leads com movimento nos últimos 90 dias. */
const JANELA_FUNIL_DIAS = 90
const POR_LISTA = 50

const TIPO_LABEL: Record<string, string> = {
  BOAS_VINDAS:         '👋 Boas-vindas',
  AGENDAMENTO:         '📅 Agendamento',
  PEDIDO_CONFIRMADO:   '✅ Pedido confirmado',
  PEDIDO_ENVIADO:      '🚀 Pedido enviado',
  CARRINHO_ABANDONADO: '🛒 Carrinho abandonado',
  POS_VENDA:           '⭐ Pós-venda',
  REATIVACAO:          '🔄 Reativação',
  MANUAL:              '✍️ Manual',
}

function AlternadorVista({ vista }: { vista: 'funil' | 'lista' }) {
  const opcoes = [
    { id: 'funil', label: 'Funil', icone: KanbanSquare },
    { id: 'lista', label: 'Lista', icone: Rows3 },
  ] as const

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-brand-border bg-brand-surface-2 p-0.5">
      {opcoes.map((o) => (
        <Link
          key={o.id}
          href={`/admin/crm?vista=${o.id}`}
          aria-current={vista === o.id ? 'page' : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
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

function CardEstatistica({
  label, valor, icone: Icone, tom,
}: {
  label: string
  valor: number
  icone: LucideIcon
  tom: TomStatus
}) {
  return (
    <Card className="p-4">
      <span
        className={cn(
          'mb-2 flex h-8 w-8 items-center justify-center rounded-full',
          TOM_FUNDO[tom],
          TOM_TEXTO[tom],
        )}
      >
        <Icone size={16} />
      </span>
      <p className="font-barlow text-2xl font-bold tabular-nums text-brand-text">{valor}</p>
      <p className="text-xs text-brand-muted">{label}</p>
    </Card>
  )
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: { vista?: string }
}) {
  const vista = searchParams.vista === 'lista' ? 'lista' : 'funil'

  const [totalLeads, responderam, convertidos, pendentes, falhas, enviadas] = await Promise.all([
    prisma.crmLead.count(),
    prisma.crmLead.count({ where: { etapa: 'RESPONDEU' } }),
    prisma.crmLead.count({ where: { etapa: 'CONVERTIDO' } }),
    prisma.crmMensagem.count({ where: { status: 'PENDENTE' } }),
    prisma.crmMensagem.count({ where: { status: 'FALHA' } }),
    prisma.crmMensagem.count({ where: { status: { in: ['ENVIADA', 'ENTREGUE', 'LIDA'] } } }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Funil de leads"
        descricao="Arraste o card pela alça para mover o lead de etapa — ou use “Mover para…” no celular. O selo vermelho mostra quem está parado sem contato."
        acoes={<AlternadorVista vista={vista} />}
      />

      <WhatsAppConnect />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <CardEstatistica label="Total de leads" valor={totalLeads} icone={Users} tom="info" />
        <CardEstatistica label="Responderam" valor={responderam} icone={MessageCircle} tom="info" />
        <CardEstatistica label="Convertidos" valor={convertidos} icone={TrendingUp} tom="success" />
        <CardEstatistica label="Msgs enviadas" valor={enviadas} icone={CheckCircle2} tom="success" />
        <CardEstatistica label="Na fila" valor={pendentes} icone={Clock} tom="warning" />
        <CardEstatistica label="Falhas" valor={falhas} icone={AlertCircle} tom="danger" />
      </div>

      {vista === 'funil' ? <VistaFunil /> : <VistaLista />}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Vista funil — o Kanban
   ═══════════════════════════════════════════════════════════════════ */

async function VistaFunil() {
  const desde = new Date(Date.now() - JANELA_FUNIL_DIAS * 24 * 60 * 60 * 1000)

  const leads = await prisma.crmLead.findMany({
    where: { updatedAt: { gte: desde } },
    orderBy: { updatedAt: 'desc' },
    take: 300,
  })

  if (leads.length === 0) {
    return (
      <EmptyState
        titulo="Nenhum lead nos últimos 90 dias"
        descricao="Quando alguém preencher o pop-up, clicar no botão de WhatsApp de um produto, abandonar o carrinho ou agendar um serviço, o lead aparece aqui."
      />
    )
  }

  const agora = Date.now()
  const itens: LeadKanban[] = leads.map((l) => ({
    id: l.id,
    coluna: l.etapa,
    rotulo: `Lead ${l.nome}`,
    nome: l.nome,
    whatsapp: l.whatsapp,
    origem: l.origem,
    produtoSlug: l.produtoSlug,
    diasParado: Math.floor((agora - l.updatedAt.getTime()) / (24 * 60 * 60 * 1000)),
  }))

  return <LeadsKanban leads={itens} />
}

/* ═══════════════════════════════════════════════════════════════════
   Vista lista — leads capturados + fila de mensagens (funcionalidade
   original da tela, só reconstruída com os primitives)
   ═══════════════════════════════════════════════════════════════════ */

async function VistaLista() {
  const [leads, mensagens] = await Promise.all([
    prisma.crmLead.findMany({ orderBy: { createdAt: 'desc' }, take: POR_LISTA }),
    prisma.crmMensagem.findMany({ orderBy: { createdAt: 'desc' }, take: POR_LISTA }),
  ])

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="overflow-hidden">
        <div className="border-b border-brand-hair px-5 py-3.5">
          <h2 className="flex items-center gap-2 font-barlow text-lg font-bold text-brand-text">
            <Users size={16} className="text-brand-accent" />
            Leads capturados
          </h2>
        </div>
        <div className="admin-scroll max-h-[560px] divide-y divide-brand-hair overflow-y-auto">
          {leads.length === 0 ? (
            <EmptyState
              compacto
              titulo="Nenhum lead ainda"
              descricao="Assim que alguém preencher o pop-up ou clicar em WhatsApp, aparece aqui."
              className="border-0"
            />
          ) : (
            leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brand-text">{lead.nome}</p>
                  <p className="text-xs text-brand-muted">{lead.whatsapp} · {lead.origem}</p>
                  <p className="text-[10px] text-brand-dim">
                    {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(lead.createdAt)}
                  </p>
                </div>
                <StatusPill status={lead.etapa} className="shrink-0" />
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-brand-hair px-5 py-3.5">
          <h2 className="flex items-center gap-2 font-barlow text-lg font-bold text-brand-text">
            <MessageCircle size={16} className="text-brand-accent" />
            Mensagens recentes
          </h2>
        </div>
        <div className="admin-scroll max-h-[560px] divide-y divide-brand-hair overflow-y-auto">
          {mensagens.length === 0 ? (
            <EmptyState
              compacto
              titulo="Nenhuma mensagem ainda"
              descricao="As mensagens automáticas e manuais enviadas por WhatsApp aparecem aqui."
              className="border-0"
            />
          ) : (
            mensagens.map((msg) => (
              <div key={msg.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <p className="truncate text-xs font-medium text-brand-text">{msg.nome}</p>
                      <span className="text-[10px] text-brand-muted">{msg.whatsapp}</span>
                    </div>
                    <p className="text-[10px] text-brand-dim">{TIPO_LABEL[msg.tipo] ?? msg.tipo}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-brand-muted opacity-70">{msg.conteudo}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill status={msg.status} />
                    <p className="mt-1 text-[10px] text-brand-dim">
                      {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
