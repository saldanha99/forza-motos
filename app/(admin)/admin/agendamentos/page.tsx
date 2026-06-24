export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { AlterarStatusAgendamento } from '@/components/admin/AlterarStatusAgendamento'
import { AgendaCalendario } from '@/components/admin/AgendaCalendario'
import { whatsappLink } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'

export const metadata = { title: 'Agendamentos — Forza Admin' }

export default async function AgendamentosAdminPage() {
  const agendamentos = await prisma.appointment.findMany({
    orderBy: { dataPreferida: 'asc' },
    take: 200,
  })

  // Serializar para o cliente (Date → string)
  const agendamentosSerial = agendamentos.map(a => ({
    id: a.id,
    nome: a.nome,
    telefone: a.telefone,
    servico: a.servico,
    motoModelo: a.motoModelo,
    dataPreferida: a.dataPreferida.toISOString(),
    horarioPreferido: a.horarioPreferido,
    status: a.status,
    notas: a.notas,
  }))

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Agendamentos</h1>
        <p className="text-brand-muted text-sm mt-1">
          {agendamentos.length} agendamento(s) registrado(s)
        </p>
      </div>

      {/* Calendário visual */}
      <AgendaCalendario agendamentos={agendamentosSerial} />

      {/* Lista completa */}
      {agendamentos.length > 0 && (
        <div className="mt-10">
          <h2 className="font-barlow font-bold text-xl text-brand-text mb-4">Lista Completa</h2>
          <div className="space-y-3">
            {agendamentos.map((a) => {
              const whatsMsg = `Olá ${a.nome}! Confirmamos seu agendamento para ${a.servico} no dia ${formatDate(a.dataPreferida)} às ${a.horarioPreferido}. Forza Motos.`
              return (
                <div
                  key={a.id}
                  className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl p-5 hover:border-brand-accent/30 hover:bg-black/30 transition-all duration-200 shadow-lg"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap mb-1">
                        <span className="font-semibold text-brand-text">{a.nome}</span>
                        {statusBadge(a.status)}
                      </div>
                      <p className="text-sm text-brand-muted">{a.servico} · {a.motoModelo}</p>
                      <p className="text-sm text-brand-muted">
                        {formatDate(a.dataPreferida)} às {a.horarioPreferido}
                      </p>
                      <p className="text-xs text-brand-muted/60 mt-1">
                        {a.telefone} · Recebido em {formatDate(a.createdAt)}
                      </p>
                      {a.notas && (
                        <p className="text-xs text-brand-muted mt-1 italic border-l-2 border-brand-accent/30 pl-2">"{a.notas}"</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <a
                        href={whatsappLink(a.telefone.replace(/\D/g, ''), whatsMsg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs px-3 py-2 rounded-xl transition-all duration-200 font-medium shadow-md shadow-emerald-900/30 border border-emerald-500/20"
                      >
                        <MessageCircle size={14} />
                        WhatsApp
                      </a>
                      <AlterarStatusAgendamento agendamentoId={a.id} statusAtual={a.status} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
