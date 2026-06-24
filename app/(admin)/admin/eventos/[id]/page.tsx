export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { EventoForm } from '@/components/admin/EventoForm'

export default async function EditarEventoPage({ params }: { params: { id: string } }) {
  const evento = await prisma.evento.findUnique({ where: { id: params.id } })
  if (!evento) notFound()

  return (
    <div className="max-w-3xl">
      <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight mb-8">Editar Evento</h1>
      <EventoForm evento={{
        ...evento,
        preco: Number(evento.preco),
        dataInicio: evento.dataInicio.toISOString(),
        dataFim: evento.dataFim?.toISOString() ?? null,
      }} />
    </div>
  )
}
