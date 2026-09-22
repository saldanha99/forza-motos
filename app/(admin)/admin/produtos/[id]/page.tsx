export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import { ProdutoForm } from '@/components/admin/ProdutoForm'
import { PageHeader } from '@/components/admin/ui/primitives'

export default async function EditarProdutoPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [produto, segmentosPneu] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id } }),
    prisma.pneuSegmento.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: { id: true, nome: true },
    }).catch(() => []),
  ])
  if (!produto) notFound()
  if (produto.eventoPirelliId) redirect('/admin/evento-pirelli/produtos')

  return (
    <div className="max-w-3xl">
      <PageHeader
        titulo="Editar produto"
        descricao="Alterações aqui refletem na loja assim que salvas. Use “Sync agora” para trazer preço, estoque e dados atuais do Tiny."
      />
      <ProdutoForm produto={produto as any} segmentosPneu={segmentosPneu} />
    </div>
  )
}
