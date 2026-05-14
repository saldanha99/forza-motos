export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { FAQSection } from '@/components/store/FAQSection'
import { MODELOS_MOTOS, getModelosPorMarca } from '@/lib/motos-modelos'
import { CheckCircle2, Wrench, Clock, Shield } from 'lucide-react'
import { SITE_URL } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Pneus de Moto em Campinas — Instalação Inclusa na Loja',
  description:
    'Compre pneus de moto em Campinas/SP com instalação inclusa. Credenciada Pirelli, Metzeler, Michelin e Bridgestone. Retire e já saia rodando. (19) 97404-9445.',
  keywords: [
    'pneu moto Campinas',
    'pneu Pirelli moto',
    'pneu Metzeler',
    'pneu Michelin moto',
    'troca pneu moto',
    'loja pneus motos Campinas',
  ],
  alternates: { canonical: `${SITE_URL}/pneus` },
  openGraph: {
    title: 'Pneus de Moto em Campinas — Forza Motos',
    description: 'Instalação inclusa. Pirelli · Metzeler · Michelin · Bridgestone.',
    type: 'website',
    url: `${SITE_URL}/pneus`,
  },
}

const FAQS = [
  {
    question: 'Quanto custa trocar o pneu da moto em Campinas?',
    answer:
      'Na Forza Motos, o serviço de instalação está INCLUSO no preço do pneu — você paga apenas o valor do pneu e já sai rodando. Para clientes que trazem o próprio pneu, cobramos a partir de R$ 30 pela montagem e balanceamento.',
  },
  {
    question: 'Qual pneu serve na minha moto?',
    answer:
      'A medida correta está no próprio pneu da sua moto (ex.: 90/90-19 ou 100/90-18). Na dúvida, mande uma foto pelo nosso WhatsApp (19) 97404-9445 que indicamos o modelo certo para sua moto.',
  },
  {
    question: 'Pneu tubeless ou com câmara, qual escolher?',
    answer:
      'Tubeless (sem câmara) é mais moderno, mais seguro em furos (perde ar lentamente) e exige aro próprio. Pneu com câmara é mais barato mas tem furo mais súbito. A maioria das motos novas (a partir de 2010) já sai de fábrica para tubeless.',
  },
  {
    question: 'Quando devo trocar o pneu da moto?',
    answer:
      'Os principais sinais são: profundidade dos sulcos abaixo de 1mm (use uma moeda como referência), rachaduras laterais, idade superior a 5 anos (mesmo com pouco uso), e perda de aderência em curvas ou frenagens. Em média, pneus de moto duram entre 15.000 e 30.000 km.',
  },
  {
    question: 'Vocês instalam o pneu no mesmo dia da compra?',
    answer:
      'Sim. Nosso box rápido faz a troca em até 30 minutos, sem necessidade de agendamento prévio. Basta vir até nossa loja na R. Funilense, 110 — Campinas/SP, em horário comercial.',
  },
  {
    question: 'Qual a garantia dos pneus vendidos?',
    answer:
      'Todos os nossos pneus têm garantia de 60 dias contra defeitos de fabricação, válida diretamente com o fabricante (Pirelli, Metzeler, Michelin, etc). Para defeitos identificados na instalação, fazemos a troca imediata.',
  },
]

async function getDadosPneus() {
  const [pneusDestaque, marcas] = await Promise.all([
    prisma.product.findMany({
      where: {
        ativo: true,
        estoque: { gt: 0 },
        
        OR: [
          { categoria: { contains: 'pneu', mode: 'insensitive' } },
          { nome: { contains: 'pneu', mode: 'insensitive' } },
        ],
      },
      take: 12,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.product.findMany({
      where: {
        ativo: true,
        estoque: { gt: 0 },
        
        OR: [
          { categoria: { contains: 'pneu', mode: 'insensitive' } },
          { nome: { contains: 'pneu', mode: 'insensitive' } },
        ],
      },
      select: { marca: true },
      distinct: ['marca'],
    }),
  ])

  return {
    pneusDestaque,
    marcas: marcas.map((m) => m.marca).filter(Boolean),
  }
}

export default async function PneusPage() {
  const { pneusDestaque, marcas } = await getDadosPneus()
  const modelosPorMarca = getModelosPorMarca()

  return (
    <>
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb items={[{ name: 'Pneus', url: '/pneus' }]} />
      </div>

      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #2a2a44 100%)',
          color: '#fff',
          padding: '64px 0 56px',
        }}
      >
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1
              className="font-barlow font-black text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-4"
              style={{ letterSpacing: '-1px' }}
            >
              Pneus de Moto em Campinas
            </h1>
            <p className="text-[#cbd] text-lg md:text-xl font-inter leading-relaxed mb-6 max-w-[480px]">
              Credenciada Pirelli, Metzeler e Michelin. Troca em 30 minutos, sem agendamento. Instalação inclusa.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/produtos?categoria=Pneus"
                className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors"
              >
                Comprar online
              </Link>
              <Link
                href="/agendar"
                className="border border-white/30 hover:border-white text-white font-barlow font-bold uppercase px-7 py-3 rounded text-sm tracking-wider transition-colors"
              >
                Agendar troca
              </Link>
            </div>
            <div className="flex flex-wrap gap-5 mt-8 text-sm text-[#cbd] font-inter">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-green-400" /> Instalação inclusa</span>
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-green-400" /> 30 minutos</span>
              <span className="flex items-center gap-1.5"><Shield size={14} className="text-green-400" /> Garantia 60 dias</span>
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="relative w-72 h-72">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle, #d42b2b22 0%, transparent 70%)',
                  animation: 'pulse-glow 3s ease-in-out infinite',
                }}
              />
              <svg viewBox="0 0 200 200" className="relative w-full h-full" style={{ animation: 'spin-slow 18s linear infinite' }}>
                <circle cx="100" cy="100" r="92" fill="none" stroke="#444" strokeWidth="2" />
                <circle cx="100" cy="100" r="55" fill="#1a1a2e" stroke="#d42b2b" strokeWidth="3" />
                {Array.from({ length: 16 }).map((_, i) => {
                  const a = (i / 16) * Math.PI * 2
                  return (
                    <line
                      key={i}
                      x1={100 + 60 * Math.cos(a)}
                      y1={100 + 60 * Math.sin(a)}
                      x2={100 + 88 * Math.cos(a)}
                      y2={100 + 88 * Math.sin(a)}
                      stroke="#666"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                  )
                })}
                <text x="100" y="106" textAnchor="middle" fill="#d42b2b" fontSize="20" fontWeight="bold" fontFamily="Barlow">
                  PNEUS
                </text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Marcas credenciadas */}
      <section className="py-10 bg-[#fafafa] border-b border-[#eee]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <p className="text-center text-xs font-inter tracking-[2px] text-[#888] uppercase mb-5">
            Marcas credenciadas
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            {['Pirelli', 'Metzeler', 'Michelin', 'Bridgestone', 'Rinaldi'].map((b) => (
              <span
                key={b}
                className="font-barlow font-black text-2xl text-[#444] tracking-[2px]"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Filtro por modelo de moto */}
      <section className="py-14 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-2" style={{ letterSpacing: '-0.5px' }}>
            Encontre o pneu certo para sua moto
          </h2>
          <p className="text-center text-[#666] font-inter mb-10">
            Selecione o modelo da sua moto para ver os pneus compatíveis
          </p>

          <div className="space-y-8">
            {Array.from(modelosPorMarca.entries()).map(([marca, modelos]) => (
              <div key={marca}>
                <h3 className="font-barlow font-bold text-lg text-[#333] mb-3 uppercase tracking-wider">
                  {marca}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {modelos.map((m) => (
                    <Link
                      key={m.slug}
                      href={`/pneus/${m.slug}`}
                      className="block px-4 py-3 bg-[#fafafa] hover:bg-[#d42b2b] border border-[#eee] hover:border-[#d42b2b] hover:text-white rounded-md text-sm font-inter text-[#333] transition-all duration-150"
                    >
                      {m.nome}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pneus em destaque */}
      {pneusDestaque.length > 0 && (
        <section className="py-14 bg-[#fafafa] border-t border-[#eee]">
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-2" style={{ letterSpacing: '-0.5px' }}>
              Pneus mais vendidos
            </h2>
            <p className="text-center text-[#666] font-inter mb-10">
              Os pneus que mais saem da nossa loja todo mês
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pneusDestaque.slice(0, 8).map((p) => (
                <ProductCard key={p.id} produto={p as any} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Por que comprar aqui */}
      <section className="py-14 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-10" style={{ letterSpacing: '-0.5px' }}>
            Por que comprar pneu na Forza Motos?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Wrench size={32} />, title: 'Instalação inclusa', desc: 'Comprou? Já sai rodando. Sem cobrança extra pela montagem.' },
              { icon: <Clock size={32} />, title: 'Box rápido', desc: 'Troca em 30 minutos sem agendamento. Box dedicado para motos.' },
              { icon: <Shield size={32} />, title: 'Garantia oficial', desc: 'Todos os pneus com garantia de fábrica. Pirelli, Metzeler, Michelin.' },
            ].map((item, idx) => (
              <div key={idx} className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#d42b2b]/10 text-[#d42b2b] mb-4">
                  {item.icon}
                </div>
                <h3 className="font-barlow font-bold text-xl text-[#111] mb-2">{item.title}</h3>
                <p className="text-[#666] font-inter text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FAQSection
        title="Perguntas frequentes sobre pneus de moto"
        items={FAQS}
      />
    </>
  )
}
