export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { CuponsManager } from '@/components/admin/CuponsManager'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Cupons — Forza Admin' }

export default async function CuponsAdminPage() {
  const cupons = await prisma.cupom.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => [])

  // Decimal do Prisma não serializa direto para client component
  const cuponsSerial = cupons.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    tipo: c.tipo,
    valor: Number(c.valor),
    minSubtotal: c.minSubtotal ? Number(c.minSubtotal) : null,
    validadeAte: c.validadeAte ? c.validadeAte.toISOString() : null,
    usoMaximo: c.usoMaximo,
    usados: c.usados,
    ativo: c.ativo,
    descricao: c.descricao,
  }))

  return (
    <div>
      <PageHeader
        titulo="Cupons"
        descricao="Descontos para o e-commerce e eventos (ex.: pré-venda de Sorocaba) — o desconto é sempre validado no servidor no checkout."
      />
      <CuponsManager cuponsIniciais={cuponsSerial} />
    </div>
  )
}
