'use client'

import { Bike, Clock, MessageCircle, Wrench } from 'lucide-react'
import { formatDate, whatsappLink } from '@/lib/utils'
import { KanbanBoard, type ColunaKanban, type ItemKanban } from './KanbanBoard'
import { Badge } from '@/components/admin/ui/primitives'

export type AgendamentoKanban = ItemKanban & {
  nome: string
  telefone: string
  servico: string
  motoModelo: string
  dataPreferida: string
  horarioPreferido: string
  /** Data preferida já passou (não conta o dia de hoje). */
  atrasado: boolean
  /** Data preferida é hoje. */
  hoje: boolean
}

/**
 * As colunas falam a língua da operação, não a do enum: quem opera precisa
 * saber o que fazer a seguir, não como o campo se chama no banco.
 */
export const COLUNAS_AGENDAMENTO: ColunaKanban[] = [
  {
    id: 'pendente',
    titulo: 'A confirmar',
    tom: 'danger',
    vazio: 'Agendamentos feitos pelo site caem aqui esperando confirmação.',
  },
  {
    id: 'confirmado',
    titulo: 'Confirmado',
    tom: 'info',
    vazio: 'Ao confirmar com o cliente, arraste o card pra cá.',
  },
  {
    id: 'concluido',
    titulo: 'Concluído',
    tom: 'success',
    vazio: 'Serviço executado — arraste pra cá para dar baixa no estoque reservado.',
  },
  {
    id: 'cancelado',
    titulo: 'Cancelado',
    tom: 'neutro',
    vazio: 'Nenhum agendamento cancelado no período.',
  },
]

async function alterarStatus(id: string, status: string) {
  const r = await fetch(`/api/admin/agendamentos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!r.ok) {
    const { error } = await r.json().catch(() => ({ error: '' }))
    throw new Error(error || 'O servidor recusou a mudança de status.')
  }
}

export function AgendamentosKanban({ agendamentos }: { agendamentos: AgendamentoKanban[] }) {
  return (
    <KanbanBoard<AgendamentoKanban>
      colunas={COLUNAS_AGENDAMENTO}
      itens={agendamentos}
      onMover={(a, para) => alterarStatus(a.id, para)}
      resumoColuna={(itens) => {
        const hoje = itens.filter((i) => i.hoje).length
        return hoje > 0 ? `${hoje} para hoje` : null
      }}
      renderCard={(a, { overlay }) => {
        const tel = a.telefone.replace(/\D/g, '')
        const whatsMsg = `Olá ${a.nome}! Sobre seu agendamento de ${a.servico} na Forza Motos.`

        return (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-brand-text">{a.nome}</span>
              {a.atrasado && (
                <Badge tom="danger" className="shrink-0">Atrasado</Badge>
              )}
              {!a.atrasado && a.hoje && (
                <Badge tom="warning" className="shrink-0">Hoje</Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-brand-muted">
              <Wrench size={11} className="shrink-0" />
              <span className="truncate">{a.servico}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-brand-muted">
              <Bike size={11} className="shrink-0" />
              <span className="truncate">{a.motoModelo}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-brand-dim">
              <Clock size={11} className="shrink-0" />
              <span>{formatDate(a.dataPreferida)} às {a.horarioPreferido}</span>
            </div>

            {!overlay && (
              <a
                href={whatsappLink(tel, whatsMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-success-soft px-2 py-1 text-[11px] font-semibold text-brand-success hover:brightness-95"
              >
                <MessageCircle size={11} />
                {a.telefone}
              </a>
            )}
          </div>
        )
      }}
    />
  )
}
