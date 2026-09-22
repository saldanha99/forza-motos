export const dynamic = 'force-dynamic'
import type { Metadata } from 'next'
import type { Prisma } from '@prisma/client'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { Breadcrumb } from '@/components/store/Breadcrumb'
import { FAQSection } from '@/components/store/FAQSection'
import { MARCAS_PNEUS } from '@/lib/menu-loja'
import { getBannerUrls } from '@/lib/marketing'
import { BuscaPorPlaca } from '@/components/store/BuscaPorPlaca'
import { BuscaPorMedida } from '@/components/store/BuscaPorMedida'
import { getIndiceMedidas } from '@/lib/indice-medidas'
import { CheckCircle2, Wrench, Clock, Shield, Award, Zap, CalendarDays, Gift, MapPin } from 'lucide-react'
import { SITE_URL } from '@/lib/schema'
import { LogoPirelli, LogoMichelin, LogoMetzeler } from '@/components/store/BrandLogo'
import { EVENTO_PIRELLI_SLUG } from '@/lib/evento-pirelli'

export const metadata: Metadata = {
  title: 'Pneus de Moto em Campinas — Credenciada Pirelli, Metzeler e Michelin',
  description:
    'Revenda oficial Pirelli, Metzeler e Michelin em Campinas/SP. Instalação inclusa, troca em 30min com agendamento online. Mais de 400 modelos em estoque. (19) 97404-9445.',
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
    description: 'Instalação e balanceamento inclusos. Pirelli · Metzeler · Michelin.',
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
      'Sim. Nosso box rápido faz a troca em até 30 minutos. Agende pelo WhatsApp (19) 97404-9445 para garantir seu horário e vá até a loja na R. Funilense, 110 — Campinas/SP.',
  },
  {
    question: 'Qual a garantia dos pneus vendidos?',
    answer:
      'Todos os nossos pneus têm garantia de 60 dias contra defeitos de fabricação, válida diretamente com o fabricante (Pirelli, Metzeler, Michelin, etc). Para defeitos identificados na instalação, fazemos a troca imediata.',
  },
]

async function getDadosPneus(campanhaEvento = false) {
  const wherePneus: Prisma.ProductWhereInput = {
    ativo: true,
    estoque: { gt: 0 },
    preco: { gt: 0, not: 999 },
    variacaoDe: null,
    AND: [
      {
        OR: [
          { categoria: { contains: 'pneu', mode: 'insensitive' } },
          { nome: { contains: 'pneu', mode: 'insensitive' } },
        ],
      },
      ...(campanhaEvento ? [{ OR: [
        { marca: { contains: 'pirelli', mode: 'insensitive' as const } },
        { marca: { contains: 'metzeler', mode: 'insensitive' as const } },
      ] }] : []),
    ],
  }

  const [pneusDestaque, marcas, indiceMedidas] = await Promise.all([
    prisma.product.findMany({
      where: wherePneus,
      take: 12,
      orderBy: { updatedAt: 'desc' },
      select: {
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
      },
    }),
    prisma.product.findMany({
      where: wherePneus,
      select: { marca: true },
      distinct: ['marca'],
    }),
    getIndiceMedidas(),
  ])

  return {
    pneusDestaque: pneusDestaque.map((produto) => ({
      ...produto,
      preco: Number(produto.preco),
      precoPromocional: produto.precoPromocional === null ? null : Number(produto.precoPromocional),
    })),
    marcas: marcas.map((m) => m.marca).filter(Boolean),
    indiceMedidas,
  }
}

export default async function PneusPage(props: { searchParams?: Promise<{ evento?: string }> }) {
  const searchParams = await props.searchParams;
  const campanhaEvento = searchParams?.evento === 'pirelli'
  const [{ pneusDestaque, indiceMedidas }, banners, eventoPirelli] = await Promise.all([
    getDadosPneus(campanhaEvento),
    getBannerUrls(),
    campanhaEvento ? prisma.eventoPirelli.findUnique({ where: { slug: EVENTO_PIRELLI_SLUG } }) : Promise.resolve(null),
  ])

  return (
    <>
      {campanhaEvento && <BannerOfertasEventoPirelli evento={eventoPirelli} />}
      <div className="max-w-[1280px] mx-auto px-4 md:px-12">
        <Breadcrumb items={[{ name: 'Pneus', url: '/pneus' }]} />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ color: '#fff', padding: '64px 0 56px' }}>
        <Image src={banners['hero-pneus']} alt="" fill sizes="100vw" className="object-cover object-center" priority />
        {/* Arte já é escura com o pneu à direita — overlay só no lado do texto */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, rgba(8,8,14,0.88) 0%, rgba(8,8,14,0.55) 45%, rgba(8,8,14,0.10) 100%)' }} />
        <div className="relative z-10 max-w-[1280px] mx-auto px-6 md:px-12 grid md:grid-cols-2 gap-10 items-center">
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
              A única loja em Campinas credenciada oficialmente por <strong className="text-white">Pirelli</strong>, <strong className="text-white">Metzeler</strong> e <strong className="text-white">Michelin</strong>. Troca em 30 minutos, instalação e balanceamento inclusos no preço.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/produtos?categoria=Pneus"
                className="bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase px-8 py-3.5 rounded text-sm tracking-wider transition-colors"
              >
                Ver todos os pneus
              </Link>
              <Link
                href="/agendar"
                className="border border-white/30 hover:border-white/70 hover:bg-white/5 text-white font-barlow font-bold uppercase px-8 py-3.5 rounded text-sm tracking-wider transition-colors"
              >
                Compre o pneu e ganhe a troca
              </Link>
            </div>
            <div className="flex flex-wrap gap-5 mt-8 text-[13px] text-white/70 font-inter">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={14} className="text-emerald-400" /> Instalação e balanceamento inclusos</span>
              <span className="flex items-center gap-1.5"><Zap size={14} className="text-emerald-400" /> Troca em 30 min</span>
              <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-400" /> Garantia de fábrica</span>
              <span className="flex items-center gap-1.5"><Clock size={14} className="text-emerald-400" /> Box rápido com agendamento</span>
            </div>
          </div>
          {/* Coluna direita vazia de propósito: a arte do banner (pneu em close) ocupa esse espaço */}
          <div className="hidden md:block" />
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
          </div>
          <p className="text-center text-[12px] text-[#aaa] mt-6 font-inter">
            Garantia oficial de fábrica em todos os pneus
          </p>
        </div>
      </section>


      {/* 4 formas de encontrar o pneu certo */}
      <section className="py-8 bg-[#111]">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <p className="text-center text-[11px] font-semibold tracking-[2.5px] text-white/40 uppercase mb-4">
            3 formas de encontrar o pneu certo
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { href: '#placa', num: '1', titulo: 'Pela placa', desc: 'Digite a placa e a gente identifica a moto' },
              { href: '#medida', num: '2', titulo: 'Pela medida', desc: 'Está gravada na lateral do pneu' },
              { href: '#modelo', num: '3', titulo: 'Pela marca e modelo', desc: 'Pirelli Angel, Michelin Anakee, Metzeler Tourance…' },
            ].map((c) => (
              <a
                key={c.num + c.titulo}
                href={c.href}
                className="group rounded-xl border border-white/10 hover:border-[#d42b2b] bg-white/[0.04] px-4 py-3.5 transition-colors"
              >
                <p className="font-barlow font-black text-lg text-[#d42b2b] leading-none mb-1">{c.num}.</p>
                <p className="font-barlow font-bold text-white text-sm group-hover:text-[#d42b2b] transition-colors">{c.titulo}</p>
                <p className="text-[11px] text-white/50 font-inter leading-snug mt-0.5">{c.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Busca pela PLACA da moto */}
      <section id="placa" className="py-12 bg-white border-b border-[#f0f0f0] scroll-mt-24">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 flex flex-col lg:flex-row items-center gap-8">
          <div className="flex-1">
            <p className="text-[11px] font-semibold tracking-[2.5px] text-[#d42b2b] uppercase mb-2">
              Novidade
            </p>
            <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] mb-2" style={{ letterSpacing: '-0.5px' }}>
              Busque pela placa da sua moto
            </h2>
            <p className="text-[#666] font-inter">
              Digite a placa e a gente identifica sua moto e mostra os produtos compatíveis — sem precisar saber medida nem modelo.
            </p>
          </div>
          <BuscaPorPlaca />
        </div>
      </section>

      {/* Busca pela MEDIDA do pneu */}
      {indiceMedidas.length > 0 && (
        <section id="medida" className="py-14 scroll-mt-24" style={{ background: '#f7f7f8' }}>
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <BuscaPorMedida indice={indiceMedidas} />
          </div>
        </section>
      )}

      {/* Busca por MARCA e MODELO de pneu */}
      <section id="modelo" className="py-14 bg-white scroll-mt-24">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-2" style={{ letterSpacing: '-0.5px' }}>
            Busque pela marca e modelo do pneu
          </h2>
          <p className="text-center text-[#666] font-inter mb-10">
            Já sabe qual pneu quer? Vá direto ao modelo
          </p>

          <div className="space-y-8">
            {MARCAS_PNEUS.map((m) => (
              <div key={m.marca}>
                <div className="flex items-baseline gap-3 mb-3">
                  <h3 className="font-barlow font-bold text-lg text-[#333] uppercase tracking-wider">
                    {m.marca}
                  </h3>
                  <Link href={m.href} className="text-[13px] font-inter font-semibold text-[#d42b2b] hover:underline">
                    Ver todos →
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {m.modelos.map((mod) => (
                    <Link
                      key={mod.nome}
                      href={`/produtos?busca=${encodeURIComponent(mod.busca)}`}
                      className="block px-4 py-3 bg-[#fafafa] hover:bg-[#d42b2b] border border-[#eee] hover:border-[#d42b2b] hover:text-white rounded-md text-sm font-inter text-[#333] transition-all duration-150"
                    >
                      {mod.nome}
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
        <section id={campanhaEvento ? 'pneus-evento' : undefined} className="scroll-mt-24 py-14 bg-[#fafafa] border-t border-[#eee]">
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <h2 className="font-barlow font-bold text-3xl md:text-4xl text-[#111] text-center mb-2" style={{ letterSpacing: '-0.5px' }}>
              {campanhaEvento ? 'Pneus participantes' : 'Pneus mais vendidos'}
            </h2>
            <p className="text-center text-[#666] font-inter mb-10">
              {campanhaEvento ? 'Pirelli e Metzeler disponíveis no e-commerce da Forza Motos' : 'Os pneus que mais saem da nossa loja todo mês'}
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
              { icon: <Clock size={32} />, title: 'Box rápido', desc: 'Troca em 30 minutos com agendamento online. Box dedicado para motos.' },
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

function BannerOfertasEventoPirelli({ evento }: { evento: {
  dataInicio: Date | null
  dataFim: Date | null
  local: string | null
  valorMinimoPneus: Prisma.Decimal
  valorCanecaAvulsa: Prisma.Decimal
} | null }) {
  const agora = new Date()
  const inicio = evento?.dataInicio ?? new Date('2026-09-05T14:00:00.000Z')
  const fim = evento?.dataFim ?? new Date('2026-09-07T02:59:59.999Z')
  const status = agora < inicio ? 'Em breve' : agora > fim ? 'Ação encerrada' : 'Somente neste fim de semana'
  const valorMinimo = Number(evento?.valorMinimoPneus ?? 899)
  const valorCaneca = Number(evento?.valorCanecaAvulsa ?? 89)
  const dinheiro = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <section id="ofertas-evento" className="scroll-mt-24 overflow-hidden bg-[#101012] text-white">
      <div className="mx-auto grid max-w-[1280px] gap-8 px-6 py-12 md:px-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:py-16">
        <div>
          <p className="inline-flex rounded-full bg-[#f5b82e] px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-black">{status}</p>
          <h1 className="mt-5 max-w-3xl font-barlow text-4xl font-black uppercase leading-[0.95] md:text-6xl">Ofertas do Rodeo Lucky Friends</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65">Condições exclusivas da Forza Motos em pneus Pirelli e Metzeler participantes. Compre pelo site e apresente o pedido à equipe no estande.</p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/65">
            <span className="inline-flex items-center gap-2"><CalendarDays size={17} className="text-[#f5b82e]" /> 5 e 6 de setembro de 2026</span>
            <span className="inline-flex items-center gap-2"><MapPin size={17} className="text-[#f5b82e]" /> {evento?.local ?? 'Lucky Friends Arena — Sorocaba/SP'}</span>
          </div>
          <a href="#pneus-evento" className="mt-7 inline-flex min-h-12 items-center rounded-xl bg-[#dc1f26] px-6 font-barlow text-sm font-black uppercase tracking-wider text-white hover:bg-[#ef2930]">Ver pneus participantes</a>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-6">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#f5b82e]"><Gift size={17} /> Lembrança exclusiva</p>
          <p className="mt-4 font-barlow text-3xl font-black uppercase">Sua compra vira caneca personalizada</p>
          <ul className="mt-5 space-y-3 text-sm leading-relaxed text-white/65">
            <li>• Compras de pneus participantes acima de {dinheiro.format(valorMinimo)} recebem uma caneca com nome.</li>
            <li>• Caneca avulsa personalizada por {dinheiro.format(valorCaneca)}.</li>
            <li>• Benefícios válidos somente durante o evento e enquanto durarem os estoques.</li>
          </ul>
          <p className="mt-5 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/38">Os preços exibidos são os vigentes no e-commerce. Produtos participantes, estoque e liberação do brinde são confirmados pela equipe Forza Motos no estande.</p>
        </div>
      </div>
    </section>
  )
}
