export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { CuponsManager } from '@/components/admin/CuponsManager'

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
      <div className="mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Cupons</h1>
        <p className="text-brand-muted text-sm mt-1">
          Descontos para o e-commerce e eventos (ex.: pré-venda de Sorocaba). O desconto é validado no servidor no checkout.
        </p>
      </div>
      <CuponsManager cuponsIniciais={cuponsSerial} />
    </div>
  )
}
