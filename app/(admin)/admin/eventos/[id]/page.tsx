export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { EventoForm } from '@/components/admin/EventoForm'
import { Users } from 'lucide-react'
import { cn, formatPrice } from '@/lib/utils'
import {
  PageHeader, Card, CardHeader, Badge, THEAD_TH, TR_LINHA, TD_CELULA,
} from '@/components/admin/ui/primitives'

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
      <PageHeader
        titulo="Editar evento"
        descricao="Altere os dados, gerencie vagas e acompanhe as inscrições recebidas."
      />

      {/* Inscrições */}
      {evento.inscricoes.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader
            titulo={
              <span className="flex items-center gap-2">
                <Users size={16} className="text-brand-accent" />
                Inscrições ({evento.inscricoes.length})
              </span>
            }
            acao={
              <div className="flex items-center gap-4 text-xs">
                <span className="text-brand-muted">
                  {totalPagos} participante{totalPagos !== 1 ? 's' : ''} confirmado{totalPagos !== 1 ? 's' : ''}
                </span>
                {receitaTotal > 0 && (
                  <span className="font-semibold text-brand-success">{formatPrice(receitaTotal)} arrecadado</span>
                )}
                <a
                  href={`/api/admin/eventos/${evento.id}/export`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 font-semibold text-brand-text transition hover:border-brand-border-strong hover:bg-brand-elevated"
                >
                  📥 Exportar CSV
                </a>
              </div>
            }
          />
          <div className="admin-scroll overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-brand-hair bg-brand-surface-2">
                <tr className="text-[11px] uppercase tracking-[0.12em] text-brand-dim">
                  <th className={THEAD_TH}>Piloto / Moto</th>
                  <th className={THEAD_TH}>Contato</th>
                  <th className={THEAD_TH}>Garupa</th>
                  <th className={THEAD_TH}>Acomodação (Hotel)</th>
                  <th className={THEAD_TH}>Qtd</th>
                  <th className={THEAD_TH}>Total</th>
                  <th className={THEAD_TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {evento.inscricoes.map((ins) => (
                  <tr key={ins.id} className={TR_LINHA}>
                    <td className={cn(TD_CELULA, 'font-medium text-brand-text')}>
                      <div>{ins.nome}</div>
                      {ins.motoModelo && <div className="text-xs text-brand-muted font-normal">🏍️ {ins.motoModelo}</div>}
                    </td>
                    <td className={cn(TD_CELULA, 'text-xs text-brand-muted')}>
                      <div>{ins.email}</div>
                      <div>{ins.telefone}</div>
                      {ins.cpf && <div className="text-[11px] text-brand-dim">CPF: {ins.cpf}</div>}
                      {ins.cep && <div className="text-[11px] text-brand-dim">CEP: {ins.cep} Nº {ins.numeroResidencia}</div>}
                    </td>
                    <td className={cn(TD_CELULA, 'text-xs text-brand-muted')}>
                      {ins.temGarupa ? (
                        <span className="text-brand-accent font-semibold">👥 {ins.nomeGarupa || 'Sim'}</span>
                      ) : (
                        <span>Solo</span>
                      )}
                    </td>
                    <td className={cn(TD_CELULA, 'text-xs text-brand-muted')}>
                      {ins.tipoAcomodacao ? <span>{ins.tipoAcomodacao}</span> : <span className="opacity-40">-</span>}
                    </td>
                    <td className={cn(TD_CELULA, 'text-brand-muted')}>{ins.quantidade}</td>
                    <td className={cn(TD_CELULA, 'text-brand-muted')}>
                      {Number(ins.total) === 0 ? (
                        <span className="text-brand-success">Gratuito</span>
                      ) : (
                        formatPrice(Number(ins.total))
                      )}
                    </td>
                    <td className={TD_CELULA}>
                      {ins.status === 'PAGO' && <Badge tom="success">Pago</Badge>}
                      {ins.status === 'PENDENTE' && <Badge tom="warning">Pendente</Badge>}
                      {ins.status === 'CANCELADO' && <Badge tom="neutro">Cancelado</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
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
