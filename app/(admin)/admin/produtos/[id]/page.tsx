export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProdutoForm } from '@/components/admin/ProdutoForm'

export default async function EditarProdutoPage({ params }: { params: { id: string } }) {
  const produto = await prisma.product.findUnique({ where: { id: params.id } })
  if (!produto) notFound()

  return (
    <div className="max-w-3xl">
      <h1 className="font-rajdhani font-bold text-3xl text-white mb-8">Editar Produto</h1>
      <ProdutoForm produto={produto as any} />
    </div>
  )
}
