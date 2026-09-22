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
  listarLinhas,
  listarSegmentos,
  filtroProdutosDoSegmento,
} from '@/lib/pneus/segmentos'
import { ArrowLeft, ArrowRight } from 'lucide-react'

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
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await props.params
  const segmento = await getSegmento(slug)
  if (!segmento) return {}

  const title = `Pneus ${segmento.nome} — Forza Motos`
  const description =
    segmento.descricao ??
    `Pneus ${segmento.nome} na Forza Motos: Pirelli, Metzeler e Michelin com instalação e balanceamento inclusos.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/pneus/categoria/${segmento.slug}` },
    openGraph: { title, description, url: `${SITE_URL}/pneus/categoria/${segmento.slug}` },
  }
}

export default async function PneusPorSegmentoPage(props: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await props.params
  const segmento = await getSegmento(slug)
  if (!segmento) notFound()

  const [linhas, produtos, outrosSegmentos] = await Promise.all([
    listarLinhas(segmento.id),
    prisma.product.findMany({
      where: filtroProdutosDoSegmento(segmento.id),
      orderBy: [{ destaque: 'desc' }, { nome: 'asc' }],
      take: 60,
      select: SELECT_CARD,
    }),
    listarSegmentos(),
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
          ]}
        />
      </div>

      <section className="bg-[#111] py-10">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <Link
            href="/pneus"
            className="inline-flex items-center gap-1.5 text-[13px] text-white/60 hover:text-white font-inter mb-4"
          >
            <ArrowLeft size={14} /> Todas as categorias
          </Link>
          <h1 className="font-barlow font-black text-4xl md:text-[46px] text-white leading-[1.05] tracking-[-1px]">
            Pneus <span className="text-[#d42b2b]">{segmento.nome}</span>
          </h1>
          {segmento.descricao && (
            <p className="text-white/70 font-inter mt-3 max-w-[600px]">{segmento.descricao}</p>
          )}
        </div>
      </section>

      {/* Subcategorias — os modelos dentro do segmento */}
      {linhas.length > 0 && (
        <section className="py-10 bg-white border-b border-[#eee]">
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <h2 className="font-barlow font-black text-[22px] text-[#111] mb-4">
              Modelos {segmento.nome}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {linhas.map((linha) => (
                <Link
                  key={linha.slug}
                  href={`/pneus/categoria/${segmento.slug}/${linha.slug}`}
                  className="group rounded-xl border border-[#e6e6e6] hover:border-[#d42b2b] bg-white px-4 py-3.5 transition-colors"
                >
                  <p className="font-barlow font-bold text-[15px] text-[#111] leading-tight">
                    {linha.nome}
                  </p>
                  <p className="text-[12px] text-[#888] font-inter mt-0.5">
                    {linha.produtos} {linha.produtos === 1 ? 'medida' : 'medidas'}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[#d42b2b] opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver pneus <ArrowRight size={12} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-10">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          {paraCard.length === 0 ? (
            <div className="rounded-xl border border-[#eee] bg-[#fafafa] px-6 py-12 text-center">
              <p className="font-barlow font-bold text-[18px] text-[#111]">
                Ainda não temos pneus publicados nesta categoria.
              </p>
              <p className="text-[#777] font-inter text-sm mt-2">
                Fale com a gente no WhatsApp que a gente consegue para você.
              </p>
              <Link
                href="/produtos?categoria=Pneus"
                className="inline-block mt-5 bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors"
              >
                Ver todos os pneus
              </Link>
            </div>
          ) : (
            <>
              <h2 className="font-barlow font-black text-[22px] text-[#111] mb-4">
                {paraCard.length} {paraCard.length === 1 ? 'pneu' : 'pneus'} em {segmento.nome}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {paraCard.map((p) => (
                  <ProductCard key={p.id} produto={p} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Outras categorias */}
      {outrosSegmentos.length > 1 && (
        <section className="py-10 bg-[#fafafa] border-t border-[#eee]">
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <h2 className="font-barlow font-black text-[20px] text-[#111] mb-4">Outras categorias</h2>
            <div className="flex flex-wrap gap-2">
              {outrosSegmentos
                .filter((s) => s.slug !== segmento.slug)
                .map((s) => (
                  <Link
                    key={s.slug}
                    href={`/pneus/categoria/${s.slug}`}
                    className="rounded-full border border-[#ddd] hover:border-[#d42b2b] hover:text-[#d42b2b] bg-white px-4 py-2 text-[13px] font-inter text-[#444] transition-colors"
                  >
                    {s.nome}
                  </Link>
                ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
