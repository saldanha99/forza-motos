export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/store/ProductDetail'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import type { Metadata } from 'next'

const BASE = 'https://forzamotos.com.br'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await prisma.product.findUnique({ where: { slug: params.slug } })
  if (!p) return { title: 'Produto não encontrado' }

  const imagens = Array.isArray(p.imagens) ? p.imagens : []
  const preco = Number(p.precoPromocional ?? p.preco)
  const descricao = (p.descricao || p.nome).slice(0, 160)
  const url = `${BASE}/produtos/${p.slug}`

  return {
    title: p.nome,
    description: descricao,
    keywords: [p.nome, p.marca, p.categoria, 'moto', 'Campinas'].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      title: p.nome,
      description: descricao,
      url,
      type: 'website',
      images: (imagens as string[]).slice(0, 1).map((img) => ({ url: img, alt: p.nome })),
    },
    twitter: {
      card: 'summary_large_image',
      title: p.nome,
      description: descricao,
      images: imagens.length > 0 ? [String(imagens[0])] : [],
    },
  }
}

export default async function ProdutoPage({ params }: Props) {
  const produto = await prisma.product.findUnique({
    where: { slug: params.slug, ativo: true },
  })

  if (!produto) notFound()

  const relacionados = await prisma.product.findMany({
    where: {
      categoria: produto.categoria,
      ativo: true,
      estoque: { gt: 0 },
      preco: { gt: 0, not: 999 },
      id: { not: produto.id },
    },
    take: 4,
  })

  const imagens = Array.isArray(produto.imagens) ? produto.imagens : []
  const preco = Number(produto.precoPromocional ?? produto.preco)

  // JSON-LD estruturado para Google Shopping e SEO de produto
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: produto.nome,
    description: produto.descricao || produto.nome,
    sku: produto.sku,
    brand: { '@type': 'Brand', name: produto.marca || 'Forza Motos' },
    category: produto.categoria,
    image: imagens,
    url: `${BASE}/produtos/${produto.slug}`,
    offers: {
      '@type': 'Offer',
      price: preco.toFixed(2),
      priceCurrency: 'BRL',
      availability: produto.estoque > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${BASE}/produtos/${produto.slug}`,
      seller: { '@type': 'Organization', name: 'Forza Motos' },
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { name: 'Produtos', url: '/produtos' },
            { name: produto.categoria, url: `/produtos?categoria=${encodeURIComponent(produto.categoria)}` },
            { name: produto.nome, url: `/produtos/${produto.slug}` },
          ]}
        />

        <ProductDetail produto={produto} />

        {relacionados.length > 0 && (
          <section className="mt-16">
            <h2 className="font-barlow font-bold text-2xl text-[#111] mb-6 tracking-[-0.3px]">
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
    </>
  )
}
