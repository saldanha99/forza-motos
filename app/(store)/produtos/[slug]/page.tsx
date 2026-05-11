import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/store/ProductDetail'
import { ProductCard } from '@/components/store/ProductCard'
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const produto = await prisma.product.findUnique({ where: { slug: params.slug } })
  if (!produto) return { title: 'Produto não encontrado' }
  return { title: produto.nome, description: produto.descricao.slice(0, 160) }
}

export default async function ProdutoPage({ params }: Props) {
  const produto = await prisma.product.findUnique({
    where: { slug: params.slug, ativo: true },
  })

  if (!produto) notFound()

  const relacionados = await prisma.product.findMany({
    where: { categoria: produto.categoria, ativo: true, id: { not: produto.id } },
    take: 4,
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <ProductDetail produto={produto} />

      {relacionados.length > 0 && (
        <section className="mt-16">
          <h2 className="font-rajdhani font-bold text-2xl text-white mb-6 uppercase tracking-wide">
            Produtos Relacionados
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relacionados.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
