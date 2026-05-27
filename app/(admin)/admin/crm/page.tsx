import { prisma } from '@/lib/prisma'
import { MessageCircle, Users, CheckCircle2, Clock, AlertCircle, TrendingUp } from 'lucide-react'
import { WhatsAppConnect } from '@/components/admin/WhatsAppConnect'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'CRM WhatsApp — Admin Forza' }

const ETAPA_LABEL: Record<string, { label: string; color: string }> = {
  NOVO:        { label: 'Novo',       color: '#3b82f6' },
  CONTATADO:   { label: 'Contatado',  color: '#f59e0b' },
  RESPONDEU:   { label: 'Respondeu',  color: '#10b981' },
  CONVERTIDO:  { label: 'Convertido', color: '#8b5cf6' },
  PERDIDO:     { label: 'Perdido',    color: '#6b7280' },
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDENTE:  { label: 'Pendente',  color: '#f59e0b' },
  ENVIANDO:  { label: 'Enviando',  color: '#3b82f6' },
  ENVIADA:   { label: 'Enviada',   color: '#10b981' },
  ENTREGUE:  { label: 'Entregue',  color: '#10b981' },
  LIDA:      { label: 'Lida',      color: '#8b5cf6' },
  FALHA:     { label: 'Falha',     color: '#ef4444' },
  CANCELADA: { label: 'Cancelada', color: '#6b7280' },
}

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

export default async function CrmPage() {
  const [leads, mensagens, stats] = await Promise.all([
    prisma.crmLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { mensagens: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.crmMensagem.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    Promise.all([
      prisma.crmLead.count(),
      prisma.crmLead.count({ where: { etapa: 'RESPONDEU' } }),
      prisma.crmLead.count({ where: { etapa: 'CONVERTIDO' } }),
      prisma.crmMensagem.count({ where: { status: 'PENDENTE' } }),
      prisma.crmMensagem.count({ where: { status: 'FALHA' } }),
      prisma.crmMensagem.count({ where: { status: { in: ['ENVIADA', 'ENTREGUE', 'LIDA'] } } }),
    ]),
  ])

  const [totalLeads, responderam, convertidos, pendentes, falhas, enviadas] = stats

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-brand-text flex items-center gap-2">
          <MessageCircle size={24} className="text-green-400" />
          CRM WhatsApp
        </h1>
        <p className="text-brand-muted text-sm mt-1">
          Leads capturados e automações via Evolution API
        </p>
      </div>

      {/* WhatsApp Connection */}
      <WhatsAppConnect />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Leads', value: totalLeads, icon: Users, color: '#3b82f6' },
          { label: 'Responderam', value: responderam, icon: MessageCircle, color: '#10b981' },
          { label: 'Convertidos', value: convertidos, icon: TrendingUp, color: '#8b5cf6' },
          { label: 'Msgs Enviadas', value: enviadas, icon: CheckCircle2, color: '#10b981' },
          { label: 'Na Fila', value: pendentes, icon: Clock, color: '#f59e0b' },
          { label: 'Falhas', value: falhas, icon: AlertCircle, color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} className="admin-glass rounded-xl p-4 border border-brand-border/20">
            <s.icon size={18} style={{ color: s.color }} className="mb-2" />
            <p className="text-2xl font-bold text-brand-text">{s.value}</p>
            <p className="text-xs text-brand-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Leads */}
        <div className="admin-glass rounded-xl border border-brand-border/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-border/20">
            <h2 className="font-bold text-brand-text flex items-center gap-2">
              <Users size={16} className="text-brand-accent" />
              Leads Capturados
            </h2>
          </div>
          <div className="divide-y divide-brand-border/10 max-h-[500px] overflow-y-auto">
            {leads.length === 0 ? (
              <p className="text-brand-muted text-sm p-5">Nenhum lead ainda.</p>
            ) : leads.map((lead) => {
              const etapa = ETAPA_LABEL[lead.etapa] ?? { label: lead.etapa, color: '#888' }
              return (
                <div key={lead.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-brand-text truncate">{lead.nome}</p>
                    <p className="text-xs text-brand-muted">{lead.whatsapp} · {lead.origem}</p>
                    <p className="text-[10px] text-brand-muted/60">
                      {new Date(lead.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shrink-0"
                    style={{ background: etapa.color + '22', color: etapa.color, border: `1px solid ${etapa.color}33` }}
                  >
                    {etapa.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Mensagens */}
        <div className="admin-glass rounded-xl border border-brand-border/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-border/20">
            <h2 className="font-bold text-brand-text flex items-center gap-2">
              <MessageCircle size={16} className="text-brand-accent" />
              Mensagens Recentes
            </h2>
          </div>
          <div className="divide-y divide-brand-border/10 max-h-[500px] overflow-y-auto">
            {mensagens.length === 0 ? (
              <p className="text-brand-muted text-sm p-5">Nenhuma mensagem ainda.</p>
            ) : mensagens.map((msg) => {
              const status = STATUS_LABEL[msg.status] ?? { label: msg.status, color: '#888' }
              return (
                <div key={msg.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-xs text-brand-text truncate">{msg.nome}</p>
                        <span className="text-[10px] text-brand-muted">{msg.whatsapp}</span>
                      </div>
                      <p className="text-[10px] text-brand-muted/70">{TIPO_LABEL[msg.tipo] ?? msg.tipo}</p>
                      <p className="text-xs text-brand-muted mt-1 line-clamp-1 opacity-60">{msg.conteudo}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: status.color + '22', color: status.color, border: `1px solid ${status.color}33` }}
                      >
                        {status.label}
                      </span>
                      <p className="text-[10px] text-brand-muted/50 mt-1">
                        {new Date(msg.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </div>
  )
}
