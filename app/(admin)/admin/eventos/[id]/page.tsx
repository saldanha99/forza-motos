export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { EventoForm } from '@/components/admin/EventoForm'
import { Badge } from '@/components/ui/Badge'
import { Users } from 'lucide-react'

export default async function EditarEventoPage({ params }: { params: { id: string } }) {
  const evento = await prisma.evento.findUnique({
    where: { id: params.id },
    include: {
      inscricoes: { orderBy: { createdAt: 'desc' } },
    },
  })
  if (!evento) notFound()

  const totalPagos = evento.inscricoes.filter((i) => i.status === 'PAGO').reduce((sum, i) => sum + i.quantidade, 0)
  const receitaTotal = evento.inscricoes.filter((i) => i.status === 'PAGO').reduce((sum, i) => sum + Number(i.total), 0)

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Editar Evento</h1>

      {/* Inscrições */}
      {evento.inscricoes.length > 0 && (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-brand-border/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-brand-accent" />
              <h2 className="text-sm font-semibold text-brand-muted uppercase tracking-widest">Inscrições</h2>
            </div>
            <div className="flex gap-4 text-xs text-brand-muted">
              <span>{totalPagos} participante{totalPagos !== 1 ? 's' : ''} confirmado{totalPagos !== 1 ? 's' : ''}</span>
              {receitaTotal > 0 && <span className="text-emerald-400 font-semibold">R$ {receitaTotal.toFixed(2)} arrecadado</span>}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-white/[0.01]">
              <tr className="text-xs text-brand-muted uppercase tracking-widest">
                <th className="text-left px-5 py-2.5 font-medium">Nome</th>
                <th className="text-left px-5 py-2.5 font-medium">E-mail / WhatsApp</th>
                <th className="text-left px-5 py-2.5 font-medium">Qtd</th>
                <th className="text-left px-5 py-2.5 font-medium">Total</th>
                <th className="text-left px-5 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {evento.inscricoes.map((ins) => (
                <tr key={ins.id} className="border-t border-brand-border/10 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 text-brand-text font-medium">{ins.nome}</td>
                  <td className="px-5 py-3 text-brand-muted text-xs">
                    <div>{ins.email}</div>
                    <div>{ins.telefone}</div>
                  </td>
                  <td className="px-5 py-3 text-brand-muted">{ins.quantidade}</td>
                  <td className="px-5 py-3 text-brand-muted">
                    {Number(ins.total) === 0 ? <span className="text-emerald-400">Gratuito</span> : `R$ ${Number(ins.total).toFixed(2)}`}
                  </td>
                  <td className="px-5 py-3">
                    {ins.status === 'PAGO' && <Badge variant="success">Pago</Badge>}
                    {ins.status === 'PENDENTE' && <Badge variant="warning">Pendente</Badge>}
                    {ins.status === 'CANCELADO' && <Badge variant="danger">Cancelado</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EventoForm evento={{
        ...evento,
        preco: Number(evento.preco),
        dataInicio: evento.dataInicio.toISOString(),
        dataFim: evento.dataFim?.toISOString() ?? null,
        galeria: Array.isArray(evento.galeria) ? (evento.galeria as string[]) : [],
        opcoesVaga: Array.isArray(evento.opcoesVaga) ? (evento.opcoesVaga as { label: string; preco: number }[]) : [],
      }} />
    </div>
  )
}
