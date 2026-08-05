export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { FotoGrid } from '@/components/admin/FotoGrid'
import { PageHeader } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Gerenciador de Fotos' }

export default async function FotosAdminPage() {
  const [produtos, totalComFoto, total] = await Promise.all([
    prisma.product.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        sku: true,
        marca: true,
        categoria: true,
        imagens: true,
        temImagem: true,
      },
      orderBy: [
        { temImagem: 'asc' },   // sem foto primeiro
        { updatedAt: 'desc' },
      ],
      take: 500,
    }),
    prisma.product.count({ where: { ativo: true, temImagem: true } }),
    prisma.product.count({ where: { ativo: true } }),
  ])

  return (
    <div>
      <PageHeader
        titulo="Gerenciador de Fotos"
        descricao="Suba, arraste ou cole a URL da imagem de cada produto ativo — a troca é salva na hora, direto no card."
      />

      <FotoGrid
        produtos={produtos as any}
        totalSemFoto={total - totalComFoto}
        totalComFoto={totalComFoto}
        total={total}
      />
    </div>
  )
}
