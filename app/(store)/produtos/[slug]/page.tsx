export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { filtroCategoriasOcultas, categoriaOculta } from '@/lib/categorias-ocultas'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ProductDetail } from '@/components/store/ProductDetail'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import type { Metadata } from 'next'

const BASE = 'https://forzamotos.com.br'

/** Ordena tamanhos: numéricos crescentes, depois letras na ordem de vestuário */
const ORDEM_TAMANHOS = ['XPP', 'PP', 'XS', 'P', 'S', 'M', 'G', 'L', 'GG', 'XG', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL']
function ordenarTamanho(a: string, b: string): number {
  const na = Number(a), nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  if (Number.isFinite(na)) return -1
  if (Number.isFinite(nb)) return 1
  const ia = ORDEM_TAMANHOS.indexOf(a.toUpperCase())
  const ib = ORDEM_TAMANHOS.indexOf(b.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  return a.localeCompare(b)
}

/** Busca os irmãos de tamanho e monta o seletor (null se o produto não é variação) */
async function montarSeletorTamanho(produto: { sku: string; variacaoDe: string | null; slug: string }) {
  if (!produto.variacaoDe) return null
  const [pai, irmaos] = await Promise.all([
    prisma.product.findUnique({ where: { sku: produto.variacaoDe }, select: { nome: true } }),
    prisma.product.findMany({
      where: { variacaoDe: produto.variacaoDe },
      select: { slug: true, nome: true, estoque: true, ativo: true },
    }),
  ])
  if (!pai || irmaos.length < 2) return null

  const base = `${pai.nome} - `
  const tamanhos = irmaos
    .map((i) => ({
      slug: i.slug,
      label: i.nome.startsWith(base) ? i.nome.slice(base.length).trim() : i.nome,
      disponivel: i.ativo && i.estoque > 0,
      atual: i.slug === produto.slug,
    }))
    .sort((a, b) => ordenarTamanho(a.label, b.label))

  return (
    <div className="mb-6">
      <p className="text-[11px] font-inter font-semibold text-[#888] uppercase tracking-[0.5px] mb-2">
        Tamanho
      </p>
      <div className="flex flex-wrap gap-2">
        {tamanhos.map((t) =>
          t.atual ? (
            <span
              key={t.slug}
              className="min-w-[46px] text-center px-3 py-2 rounded-lg border-2 border-[#d42b2b] bg-[#d42b2b] text-white font-barlow font-bold text-sm uppercase"
            >
              {t.label}
            </span>
          ) : t.disponivel ? (
            <Link
              key={t.slug}
              href={`/produtos/${t.slug}`}
              className="min-w-[46px] text-center px-3 py-2 rounded-lg border-2 border-[#ddd] hover:border-[#d42b2b] hover:text-[#d42b2b] text-[#333] font-barlow font-bold text-sm uppercase transition-colors"
            >
              {t.label}
            </Link>
          ) : (
            <span
              key={t.slug}
              title="Esgotado"
              className="min-w-[46px] text-center px-3 py-2 rounded-lg border-2 border-[#eee] text-[#ccc] font-barlow font-bold text-sm uppercase line-through cursor-not-allowed"
            >
              {t.label}
            </span>
          ),
        )}
      </div>
    </div>
  )
}

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

  // Categoria oculta (ex: capacetes — não vendemos por enquanto): página fora do ar
  if (categoriaOculta(produto.categoria)) notFound()

  // Produto-pai não é comprável (estoque agregado): manda pro 1º tamanho disponível
  if (produto.ehPai) {
    const filho = await prisma.product.findFirst({
      where: { variacaoDe: produto.sku, ativo: true, estoque: { gt: 0 } },
      orderBy: { nome: 'asc' },
      select: { slug: true },
    })
    if (filho) redirect(`/produtos/${filho.slug}`)
    notFound()
  }

  const [seletorTamanho, relacionados] = await Promise.all([
    montarSeletorTamanho(produto),
    prisma.product.findMany({
      where: {
        categoria: produto.categoria,
        ativo: true,
        estoque: { gt: 0 },
        preco: { gt: 0, not: 999 },
        variacaoDe: null,
        id: { not: produto.id },
        ...filtroCategoriasOcultas(),
        // não sugerir o próprio pai da família como "relacionado"
        ...(produto.variacaoDe && { sku: { not: produto.variacaoDe } }),
      },
      take: 4,
    }),
  ])

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

        <ProductDetail produto={produto} seletorTamanho={seletorTamanho} />

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
