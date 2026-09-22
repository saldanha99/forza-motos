export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { PneuSegmentosManager } from '@/components/admin/PneuSegmentosManager'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Categorias de pneu' }

export default async function PneusSegmentosPage() {
  const segmentos = await prisma.pneuSegmento
    .findMany({
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: { _count: { select: { produtos: true } } },
    })
    .catch(() => [])

  return (
    <div>
      <PageHeader
        titulo="Categorias de pneu"
        descricao="Custom, Big Trail, Esportivo/Street, Scooter — o menu de /pneus. Crie, renomeie e reordene sem depender de deploy."
      />

      <PneuSegmentosManager
        segmentosIniciais={segmentos.map(({ _count, ...s }) => ({ ...s, produtos: _count.produtos }))}
      />
    </div>
  )
}
