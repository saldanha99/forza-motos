export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { MODELOS_MOTOS, getModelo } from '@/lib/motos-modelos'
import { SITE_URL } from '@/lib/schema'
import { ArrowLeft, CheckCircle2, Phone } from 'lucide-react'

export async function generateStaticParams() {
  return MODELOS_MOTOS.map((m) => ({ modelo: m.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { modelo: string }
}): Promise<Metadata> {
  const modelo = getModelo(params.modelo)
  if (!modelo) return {}

  const title = `Pneus para ${modelo.marca} ${modelo.nome} — Forza Motos Campinas`
  const description = `Encontre os pneus certos para ${modelo.marca} ${modelo.nome} na Forza Motos. Pirelli, Metzeler, Michelin com instalação inclusa em Campinas/SP. (19) 97404-9445.`

  return {
    title,
    description,
    keywords: [
      `pneu ${modelo.nome}`,
      `pneu ${modelo.marca} ${modelo.nome}`,
      `pneu moto ${modelo.cilindradas}cc`,
      `pneu para ${modelo.nome} Campinas`,
    ],
    alternates: { canonical: `${SITE_URL}/pneus/${modelo.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/pneus/${modelo.slug}`,
    },
  }
}

export default async function PneusModeloPage({
  params,
}: {
  params: { modelo: string }
}) {
  const modelo = getModelo(params.modelo)
  if (!modelo) notFound()

  // Busca produtos compatíveis: nome ou descrição contendo termos do modelo
  const orConditions = modelo.termosCompativeis.flatMap((termo) => [
    { nome: { contains: termo, mode: 'insensitive' as const } },
    { descricao: { contains: termo, mode: 'insensitive' as const } },
  ])

  const produtos = await prisma.product.findMany({
    where: {
      ativo: true,
      estoque: { gt: 0 },
      preco: { gt: 0, not: 999 },
      variacaoDe: null,
      OR: [
        { categoria: { contains: 'pneu', mode: 'insensitive' } },
        { nome: { contains: 'pneu', mode: 'insensitive' } },
      ],
      AND: { OR: orConditions },
    },
    take: 24,
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb
          items={[
            { name: 'Pneus', url: '/pneus' },
            { name: `${modelo.marca} ${modelo.nome}`, url: `/pneus/${modelo.slug}` },
          ]}
        />
      </div>

      {/* Header */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #2a2a44 100%)',
          color: '#fff',
          padding: '48px 0',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <Link
            href="/pneus"
            className="inline-flex items-center gap-1 text-sm text-[#cbd] hover:text-white transition-colors mb-3"
          >
            <ArrowLeft size={14} /> Ver todos os modelos
          </Link>
          <h1
            className="font-barlow font-black text-3xl md:text-5xl leading-tight mb-2"
            style={{ letterSpacing: '-1px' }}
          >
            Pneus para {modelo.marca} {modelo.nome}
          </h1>
          <p className="text-[#cbd] text-base md:text-lg font-inter">
            Encontre o pneu compatível com sua {modelo.nome} de {modelo.cilindradas}cc na Forza Motos em Campinas
          </p>
          <div className="flex flex-wrap gap-4 mt-5 text-sm">
            <span className="flex items-center gap-1.5 text-[#cbd]">
              <CheckCircle2 size={14} className="text-green-400" /> Instalação inclusa
            </span>
            <span className="flex items-center gap-1.5 text-[#cbd]">
              <CheckCircle2 size={14} className="text-green-400" /> Troca em 30 min
            </span>
            <a
              href="tel:+5519974049445"
              className="flex items-center gap-1.5 text-white hover:text-[#d42b2b] transition-colors"
            >
              <Phone size={14} /> (19) 97404-9445
            </a>
          </div>
        </div>
      </section>

      {/* Produtos compatíveis */}
      <section className="py-12 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-2xl md:text-3xl text-[#111] mb-6">
            Pneus compatíveis com {modelo.nome}
          </h2>

          {produtos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {produtos.map((p) => (
                <ProductCard key={p.id} produto={p as any} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-[#fafafa] rounded-lg border border-[#eee]">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-[#444] font-inter mb-2">
                Não encontramos pneus específicos para a {modelo.nome} no momento.
              </p>
              <p className="text-[#666] font-inter text-sm mb-5">
                Mas temos centenas de modelos disponíveis. Fale conosco que ajudamos a encontrar o pneu certo.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <a
                  href="https://wa.me/5519974049445?text=Ol%C3%A1!%20Preciso%20de%20pneu%20para%20minha%20moto."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-500 hover:bg-green-600 text-white font-medium px-5 py-2 rounded text-sm"
                >
                  Falar no WhatsApp
                </a>
                <Link
                  href="/produtos?categoria=Pneus"
                  className="bg-[#d42b2b] hover:bg-red-700 text-white font-medium px-5 py-2 rounded text-sm"
                >
                  Ver todos os pneus
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Outros modelos populares */}
      <section className="py-12 bg-[#fafafa] border-t border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-xl md:text-2xl text-[#111] mb-5">
            Pneus para outros modelos populares
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MODELOS_MOTOS.filter((m) => m.slug !== modelo.slug && m.marca === modelo.marca)
              .slice(0, 5)
              .map((m) => (
                <Link
                  key={m.slug}
                  href={`/pneus/${m.slug}`}
                  className="block px-4 py-3 bg-white hover:bg-[#d42b2b] border border-[#eee] hover:border-[#d42b2b] hover:text-white rounded-md text-sm font-inter text-[#333] transition-all duration-150"
                >
                  {m.marca} {m.nome}
                </Link>
              ))}
          </div>
        </div>
      </section>
    </>
  )
}
