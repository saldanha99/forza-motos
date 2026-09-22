import { prisma } from '@/lib/prisma'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { CanecasEventoPirelli } from '@/components/evento-pirelli/CanecasEventoPirelli'
export const dynamic = 'force-dynamic'
export default async function Page() {
  const evento = await obterEventoPirelli()
  const [canecas, compras, pendentesNome] = await Promise.all([
    prisma.eventoPirelliCaneca.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true, elegibilidades: { where: { revogadoEm: null } } }, orderBy: { createdAt: 'asc' } }),
    prisma.eventoPirelliCompraCaneca.findMany({ where: { eventoId: evento.id, pagamentoConfirmadoEm: { not: null } }, include: { visitante: true }, orderBy: { registradoEm: 'asc' } }),
    prisma.eventoPirelliVisitante.findMany({
      where: {
        eventoId: evento.id,
        canecaBrinde: null,
        elegibilidadesCaneca: { some: { revogadoEm: null } },
      },
      select: {
        id: true,
        nomeCompleto: true,
        whatsapp: true,
        elegibilidadesCaneca: { where: { revogadoEm: null }, select: { id: true, origem: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])
  return <CanecasEventoPirelli
    pendentesNome={pendentesNome}
    canecas={canecas.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), gravacaoIniciadaEm: c.gravacaoIniciadaEm?.toISOString() ?? null, prontaEm: c.prontaEm?.toISOString() ?? null, entregueEm: c.entregueEm?.toISOString() ?? null }))}
    compras={compras.map((c) => ({
      ...c,
      valorUnitarioSnapshot: c.valorUnitarioSnapshot ? Number(c.valorUnitarioSnapshot) : null,
      valorPago: c.valorPago ? Number(c.valorPago) : null,
      pagamentoConfirmadoEm: c.pagamentoConfirmadoEm?.toISOString() ?? null,
      registradoEm: c.registradoEm.toISOString(),
      entregueEm: c.entregueEm?.toISOString() ?? null,
    }))}
  />
}
