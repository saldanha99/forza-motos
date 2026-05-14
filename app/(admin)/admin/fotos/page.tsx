export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { FotoGrid } from '@/components/admin/FotoGrid'

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
      <div className="mb-6">
        <h1 className="font-rajdhani font-bold text-3xl text-white">Gerenciador de Fotos</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Suba imagens direto no card · Clique, arraste ou cole uma URL · Salva automaticamente
        </p>
      </div>

      <FotoGrid
        produtos={produtos as any}
        totalSemFoto={total - totalComFoto}
        totalComFoto={totalComFoto}
        total={total}
      />
    </div>
  )
}
