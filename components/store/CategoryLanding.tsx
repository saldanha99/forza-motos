import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { FAQSection, FAQItem } from '@/components/store/FAQSection'
import { CheckCircle2, ShoppingBag } from 'lucide-react'

interface CategoryLandingProps {
  slug: string
  titulo: string
  subtitulo: string
  termosBusca: string[]
  faqs: FAQItem[]
  /** Cor do gradiente do hero */
  heroFrom?: string
  heroTo?: string
  /** Ícone SVG no hero */
  heroIcon?: React.ReactNode
  /** Bullets de venda */
  bullets?: { titulo: string; desc: string }[]
}

export async function CategoryLanding({
  slug,
  titulo,
  subtitulo,
  termosBusca,
  faqs,
  heroFrom = '#1a1a2e',
  heroTo = '#2a2a44',
  heroIcon,
  bullets,
}: CategoryLandingProps) {
  const orConditions = termosBusca.flatMap((t) => [
    { nome: { contains: t, mode: 'insensitive' as const } },
    { categoria: { contains: t, mode: 'insensitive' as const } },
  ])

  const produtos = await prisma.product.findMany({
    where: {
      ativo: true,
      estoque: { gt: 0 },
      temImagem: true,
      OR: orConditions,
    },
    take: 12,
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb items={[{ name: titulo, url: `/${slug}` }]} />
      </div>

      {/* Hero */}
      <section
        style={{
          background: `linear-gradient(135deg, ${heroFrom} 0%, ${heroTo} 100%)`,
          color: '#fff',
          padding: '64px 0 56px',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1
              className="font-barlow font-black text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-4"
              style={{ letterSpacing: '-1px' }}
            >
              {titulo}
            </h1>
            <p className="text-white/85 text-lg md:text-xl font-inter leading-relaxed mb-6 max-w-[480px]">
              {subtitulo}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/produtos"
                className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors flex items-center gap-1.5"
              >
                <ShoppingBag size={14} /> Ver produtos
              </Link>
              <a
                href="https://wa.me/5519974049445"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-white/30 hover:border-white text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors"
              >
                Tirar dúvida
              </a>
            </div>
            {bullets && (
              <div className="flex flex-wrap gap-5 mt-8 text-sm text-white/80 font-inter">
                {bullets.map((b, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-green-400" /> {b.titulo}
                  </span>
                ))}
              </div>
            )}
          </div>
          {heroIcon && (
            <div className="hidden md:flex justify-center items-center">
              {heroIcon}
            </div>
          )}
        </div>
      </section>

      {/* Bullets detalhados */}
      {bullets && (
        <section className="py-12 bg-white">
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {bullets.map((b, idx) => (
                <div key={idx} className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#d42b2b]/10 text-[#d42b2b] mb-3">
                    <CheckCircle2 size={22} />
                  </div>
                  <h3 className="font-barlow font-bold text-lg text-[#111] mb-2">{b.titulo}</h3>
                  <p className="text-[#666] font-inter text-sm">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Produtos */}
      <section className="py-12 bg-[#fafafa] border-t border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2
            className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-2"
            style={{ letterSpacing: '-0.5px' }}
          >
            {titulo} disponíveis
          </h2>
          <p className="text-center text-[#666] font-inter mb-8">
            {produtos.length > 0
              ? `${produtos.length} produto${produtos.length !== 1 ? 's' : ''} em estoque`
              : 'Em breve, novos produtos chegando'}
          </p>

          {produtos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {produtos.map((p) => (
                <ProductCard key={p.id} produto={p as any} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-[#eee]">
              <p className="text-[#666] font-inter mb-4">
                Fale conosco que indicamos o produto certo para sua moto.
              </p>
              <a
                href="https://wa.me/5519974049445"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-green-500 hover:bg-green-600 text-white font-medium px-5 py-2 rounded text-sm"
              >
                Falar no WhatsApp
              </a>
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <FAQSection items={faqs} title={`Perguntas frequentes sobre ${titulo.toLowerCase()}`} />
    </>
  )
}
