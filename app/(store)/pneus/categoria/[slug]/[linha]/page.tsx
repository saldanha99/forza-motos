export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { SITE_URL } from '@/lib/schema'
import {
  getSegmento,
  acharLinhaPeloSlug,
  listarLinhas,
  filtroProdutosDoSegmento,
} from '@/lib/pneus/segmentos'
import { ArrowLeft } from 'lucide-react'

const SELECT_CARD = {
  id: true,
  nome: true,
  slug: true,
  preco: true,
  precoPromocional: true,
  imagens: true,
  estoque: true,
  marca: true,
  categoria: true,
  ehPai: true,
  preVenda: true,
  prazoEntregaDias: true,
} as const

export async function generateMetadata(props: {
  params: Promise<{ slug: string; linha: string }>
}): Promise<Metadata> {
  const { slug, linha } = await props.params
  const segmento = await getSegmento(slug)
  if (!segmento) return {}
  const linhaAtual = await acharLinhaPeloSlug(segmento.id, linha)
  if (!linhaAtual) return {}

  const title = `Pneu ${linhaAtual.nome} — ${segmento.nome} | Forza Motos`
  const description = `Pneu ${linhaAtual.nome} (${segmento.nome}) na Forza Motos, com instalação e balanceamento inclusos. Todas as medidas disponíveis.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/pneus/categoria/${segmento.slug}/${linhaAtual.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/pneus/categoria/${segmento.slug}/${linhaAtual.slug}`,
    },
  }
}

export default async function PneusPorLinhaPage(props: {
  params: Promise<{ slug: string; linha: string }>
}) {
  const { slug, linha } = await props.params
  const segmento = await getSegmento(slug)
  if (!segmento) notFound()

  const linhaAtual = await acharLinhaPeloSlug(segmento.id, linha)
  if (!linhaAtual) notFound()

  const [produtos, linhas] = await Promise.all([
    prisma.product.findMany({
      where: filtroProdutosDoSegmento(segmento.id, linhaAtual.rotulos),
      orderBy: [{ medidaAro: 'asc' }, { medidaLargura: 'asc' }, { nome: 'asc' }],
      take: 60,
      select: SELECT_CARD,
    }),
    listarLinhas(segmento.id),
  ])

  const paraCard = produtos.map((p) => ({
    ...p,
    preco: Number(p.preco),
    precoPromocional: p.precoPromocional === null ? null : Number(p.precoPromocional),
  }))

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb
          items={[
            { name: 'Pneus', url: '/pneus' },
            { name: segmento.nome, url: `/pneus/categoria/${segmento.slug}` },
            { name: linhaAtual.nome, url: `/pneus/categoria/${segmento.slug}/${linhaAtual.slug}` },
          ]}
        />
      </div>

      <section className="bg-[#111] py-10">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <Link
            href={`/pneus/categoria/${segmento.slug}`}
            className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white font-inter mb-4"
          >
            <ArrowLeft size={14} /> Pneus {segmento.nome}
          </Link>
          <h1 className="font-barlow font-black text-4xl md:text-[46px] text-white leading-[1.05] tracking-[-1px]">
            {linhaAtual.nome}
          </h1>
          <p className="text-white/70 font-inter mt-3">
            {paraCard.length} {paraCard.length === 1 ? 'medida disponível' : 'medidas disponíveis'} ·
            instalação e balanceamento inclusos
          </p>
        </div>
      </section>

      <section className="py-10">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {paraCard.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        </div>
      </section>

      {linhas.length > 1 && (
        <section className="py-10 bg-[#fafafa] border-t border-[#eee]">
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <h2 className="font-barlow font-black text-[20px] text-[#111] mb-4">
              Outros modelos {segmento.nome}
            </h2>
            <div className="flex flex-wrap gap-2">
              {linhas
                .filter((l) => l.slug !== linhaAtual.slug)
                .map((l) => (
                  <Link
                    key={l.slug}
                    href={`/pneus/categoria/${segmento.slug}/${l.slug}`}
                    className="rounded-full border border-[#ddd] hover:border-[#d42b2b] hover:text-[#d42b2b] bg-white px-4 py-2 text-[13px] font-inter text-[#444] transition-colors"
                  >
                    {l.nome}
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
