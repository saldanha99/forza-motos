import { prisma } from '@/lib/prisma'
import { obterEventoPirelli } from '@/lib/evento-pirelli'
import { CanecasEventoPirelli } from '@/components/evento-pirelli/CanecasEventoPirelli'
export const dynamic = 'force-dynamic'
export default async function Page() {
  const evento = await obterEventoPirelli()
  const [canecas, compras] = await Promise.all([
    prisma.eventoPirelliCaneca.findMany({ where: { visitante: { eventoId: evento.id } }, include: { visitante: true, elegibilidades: { where: { revogadoEm: null } } }, orderBy: { createdAt: 'asc' } }),
    prisma.eventoPirelliCompraCaneca.findMany({ where: { eventoId: evento.id }, include: { visitante: true }, orderBy: { registradoEm: 'asc' } }),
  ])
  return <CanecasEventoPirelli
    canecas={canecas.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(), gravacaoIniciadaEm: c.gravacaoIniciadaEm?.toISOString() ?? null, prontaEm: c.prontaEm?.toISOString() ?? null, entregueEm: c.entregueEm?.toISOString() ?? null }))}
    compras={compras.map((c) => ({ ...c, registradoEm: c.registradoEm.toISOString(), entregueEm: c.entregueEm?.toISOString() ?? null }))}
  />
}
