export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProdutoForm } from '@/components/admin/ProdutoForm'
import { PageHeader } from '@/components/admin/ui/primitives'

export default async function EditarProdutoPage({ params }: { params: { id: string } }) {
  const produto = await prisma.product.findUnique({ where: { id: params.id } })
  if (!produto) notFound()

  return (
    <div className="max-w-3xl">
      <PageHeader
        titulo="Editar produto"
        descricao="Alterações aqui refletem na loja assim que salvas. Use “Sync agora” para trazer preço, estoque e dados atuais do Tiny."
      />
      <ProdutoForm produto={produto as any} />
    </div>
  )
}
