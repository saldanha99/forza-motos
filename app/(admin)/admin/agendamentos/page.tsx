export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { statusBadge } from '@/components/ui/Badge'
import { AlterarStatusAgendamento } from '@/components/admin/AlterarStatusAgendamento'
import { whatsappLink } from '@/lib/utils'
import { MessageCircle } from 'lucide-react'

export const metadata = { title: 'Agendamentos Admin' }

export default async function AgendamentosAdminPage() {
  const agendamentos = await prisma.appointment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: true },
  })

  return (
    <div>
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-8">Agendamentos</h1>

      <div className="space-y-4">
        {agendamentos.map((a) => {
          const whatsMsg = `Olá ${a.nome}! Confirmamos seu agendamento para ${a.servico} no dia ${formatDate(a.dataPreferida)} às ${a.horarioPreferido}. Forza Motos.`

          return (
            <div key={a.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="font-semibold text-white">{a.nome}</span>
                    {statusBadge(a.status)}
                  </div>
                  <p className="text-sm text-zinc-400">{a.servico} · {a.motoModelo}</p>
                  <p className="text-sm text-zinc-500">{formatDate(a.dataPreferida)} às {a.horarioPreferido}</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    {a.telefone} · Recebido em {formatDate(a.createdAt)}
                  </p>
                  {a.notas && <p className="text-xs text-zinc-500 mt-1 italic">"{a.notas}"</p>}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                  <a
                    href={whatsappLink(a.telefone.replace(/\D/g, ''), whatsMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded transition-colors"
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
  )
}
