export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { ProductCard } from '@/components/store/ProductCard'
import { SITE_URL } from '@/lib/schema'
import { faixaAnoLabel, motoNomeCompleto } from '@/lib/moto'
import { Bike, Search } from 'lucide-react'

interface Props { params: { slug: string } }

async function getMoto(slug: string) {
  return prisma.moto.findUnique({
    where: { slug },
    include: {
      produtos: {
        include: { product: true },
      },
    },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const moto = await getMoto(params.slug)
  if (!moto) return { title: 'Moto não encontrada' }
  const nome = motoNomeCompleto(moto)
  return {
    title: `Peças e pneus para ${nome} — Forza Motos`,
    description: `Tudo o que serve na sua ${nome}: pneus, pastilhas, óleo, filtros e mais, com instalação em Campinas/SP e entrega para todo o Brasil.`,
    alternates: { canonical: `${SITE_URL}/moto/${moto.slug}` },
  }
}

export default async function MotoPage({ params }: Props) {
  const moto = await getMoto(params.slug)
  if (!moto) notFound()

  const nome = motoNomeCompleto(moto)

  // Só produtos ativos; agrupa por categoria
  const produtos = moto.produtos
    .map((pm) => pm.product)
    .filter((p) => p.ativo && (p.estoque > 0 || p.preVenda))

  const porCategoria = new Map<string, typeof produtos>()
  for (const p of produtos) {
    const cat = p.categoria || 'Outros'
    if (!porCategoria.has(cat)) porCategoria.set(cat, [])
    porCategoria.get(cat)!.push(p)
  }

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb items={[{ name: 'Motos', url: '/pneus' }, { name: nome, url: `/moto/${moto.slug}` }]} />
      </div>

      {/* Hero */}
      <section className="bg-[#0b0b12] text-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-10">
          <div className="flex items-center gap-2 text-[#d42b2b] text-xs font-bold uppercase tracking-widest mb-3">
            <Bike size={14} /> Compatível com sua moto
          </div>
          <h1 className="font-barlow font-black text-3xl md:text-5xl leading-tight" style={{ letterSpacing: '-1px' }}>
            {moto.marca} {moto.modelo}
          </h1>
          <p className="text-white/60 font-inter mt-2">
            Faixa {faixaAnoLabel(moto.anoDe, moto.anoAte)} · {produtos.length} produto{produtos.length === 1 ? '' : 's'} compatível{produtos.length === 1 ? '' : 'is'}
          </p>
        </div>
      </section>

      {/* Produtos por categoria */}
      <section className="py-12 bg-[#fafafa]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          {produtos.length === 0 ? (
            <div className="bg-white border border-[#eee] rounded-xl p-10 text-center">
              <p className="text-[#666] font-inter mb-4">
                Ainda não cadastramos produtos compatíveis com essa moto por aqui.
              </p>
              <Link href="/pneus#placa" className="inline-flex items-center gap-2 text-[#d42b2b] font-bold hover:underline">
                <Search size={16} /> Buscar pneus pela placa ou medida
              </Link>
            </div>
          ) : (
            <div className="space-y-10">
              {Array.from(porCategoria.entries()).map(([categoria, itens]) => (
                <div key={categoria}>
                  <h2 className="font-barlow font-bold text-xl md:text-2xl text-[#111] mb-4 capitalize">{categoria}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {itens.map((p) => (
                      <ProductCard key={p.id} produto={p as any} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
