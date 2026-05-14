export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { FAQSection } from '@/components/store/FAQSection'
import { MODELOS_MOTOS, getModelosPorMarca } from '@/lib/motos-modelos'
import { CheckCircle2, Wrench, Clock, Shield, Award, Zap } from 'lucide-react'
import { SITE_URL } from '@/lib/schema'
import { LogoPirelli, LogoMichelin, LogoMetzeler, LogoBridgestone, LogoRinaldi } from '@/components/store/BrandLogo'

export const metadata: Metadata = {
  title: 'Pneus de Moto em Campinas — Credenciada Pirelli, Metzeler e Michelin',
  description:
    'Revenda oficial Pirelli, Metzeler e Michelin em Campinas/SP. Instalação inclusa, troca em 30min, sem agendamento. Mais de 400 modelos em estoque. (19) 97404-9445.',
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
            {/* Badge credenciada */}
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
              <Award size={13} className="text-yellow-400" />
              <span className="text-[12px] font-semibold text-white/90 tracking-wider uppercase">
                Revenda Oficial Pirelli · Metzeler · Michelin
              </span>
            </div>
            <h1
              className="font-barlow font-black text-4xl md:text-5xl lg:text-[58px] leading-[1.02] mb-4"
              style={{ letterSpacing: '-1.5px' }}
            >
              Pneus de Moto<br />
              <span className="text-[#d42b2b]">em Campinas</span>
            </h1>
            <p className="text-white/75 text-lg md:text-xl font-inter leading-relaxed mb-6 max-w-[500px]">
              A única loja em Campinas credenciada oficialmente por <strong className="text-white">Pirelli</strong>, <strong className="text-white">Metzeler</strong> e <strong className="text-white">Michelin</strong>. Troca em 30 minutos, instalação inclusa no preço.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/produtos?categoria=Pneus"
                className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase px-8 py-3.5 rounded text-sm tracking-wider transition-colors"
              >
                Ver todos os pneus
              </Link>
              <Link
                href="/agendamentos"
                className="border border-white/30 hover:border-white/70 hover:bg-white/5 text-white font-barlow font-bold uppercase px-8 py-3.5 rounded text-sm tracking-wider transition-colors"
              >
                Agendar troca grátis
              </Link>
            </div>
            <div className="flex flex-wrap gap-5 mt-8 text-[13px] text-white/70 font-inter">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Instalação inclusa</span>
              <span className="flex items-center gap-1.5"><Zap size={14} className="text-emerald-400" /> Troca em 30 min</span>
              <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-400" /> Garantia de fábrica</span>
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-emerald-400" /> Sem agendamento</span>
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

      {/* Marcas credenciadas — logos reais */}
      <section className="py-10 bg-white border-b border-[#f0f0f0]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <p className="text-center text-[11px] font-semibold tracking-[2.5px] text-[#999] uppercase mb-8">
            Marcas credenciadas oficialmente
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
            <div className="opacity-80 hover:opacity-100 transition-opacity">
              <LogoPirelli height={30} />
            </div>
            <div className="opacity-80 hover:opacity-100 transition-opacity">
              <LogoMetzeler height={30} />
            </div>
            <div className="opacity-80 hover:opacity-100 transition-opacity">
              <LogoMichelin height={30} />
            </div>
            <div className="opacity-80 hover:opacity-100 transition-opacity">
              <LogoBridgestone height={28} />
            </div>
            <div className="opacity-80 hover:opacity-100 transition-opacity">
              <LogoRinaldi height={28} />
            </div>
          </div>
          <p className="text-center text-[12px] text-[#aaa] mt-6 font-inter">
            Garantia oficial de fábrica em todos os pneus
          </p>
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
