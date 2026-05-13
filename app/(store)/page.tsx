import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { FeaturedCarousel } from '@/components/store/FeaturedCarousel'
import { HeroCarousel } from '@/components/store/HeroCarousel'
import { ScrollReveal } from '@/components/store/ScrollReveal'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import { getLocalBusinessSchema } from '@/lib/schema'
import { ReviewsSection } from '@/components/store/ReviewsSection'
import { TrustBar } from '@/components/store/TrustBar'

export const metadata: Metadata = {
  title: 'Forza Motos — Pneus e Peças para Moto em Campinas/SP',
  description:
    'Credenciada Pirelli, Metzeler e Michelin. Troca de pneu em 30 min sem agendamento. Loja online com +2.800 produtos e entrega em todo Brasil.',
  alternates: { canonical: 'https://forza-motos-app.vercel.app' },
  openGraph: {
    title: 'Forza Motos — Pneus e Peças para Moto',
    description: 'Credenciada Pirelli, Metzeler e Michelin em Campinas/SP. Entrega em todo Brasil.',
    type: 'website',
  },
}

async function getHomeData() {
  try {
    // ── Mais Vendidos: usa ranking de pedidos reais; fallback = produtos com imagem + estoque ──
    const topSold = await prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantidade: true },
      orderBy: { _sum: { quantidade: 'desc' } },
      take: 12,
    })

    let maisVendidos: any[] = []
    let temVendasReais = false

    if (topSold.length >= 4) {
      // Tem vendas reais — busca os produtos do ranking
      temVendasReais = true
      const ids = topSold.map(t => t.productId)
      const prods = await prisma.product.findMany({
        where: { id: { in: ids }, ativo: true, estoque: { gt: 0 }, temImagem: true },
      })
      // Preserva ordem do ranking de vendas
      const map = new Map(prods.map(p => [p.id, p]))
      maisVendidos = ids.map(id => map.get(id)).filter(Boolean)
    } else {
      // Sem vendas ainda — usa produtos com imagem real e estoque, melhor preço
      maisVendidos = await prisma.$queryRaw`
        SELECT id, nome, slug, preco, "precoPromocional", imagens, estoque, marca, categoria, ativo
        FROM "Product"
        WHERE ativo = true AND estoque > 0 AND "temImagem" = true
        ORDER BY
          CASE WHEN "precoPromocional" IS NOT NULL THEN 0 ELSE 1 END,
          estoque DESC,
          "updatedAt" DESC
        LIMIT 12
      `
    }

    // ── Promoções com imagem ──
    const promos = await prisma.$queryRaw`
      SELECT id, nome, slug, preco, "precoPromocional", imagens, estoque, marca, categoria, ativo
      FROM "Product"
      WHERE ativo = true AND estoque > 0 AND "precoPromocional" IS NOT NULL AND "temImagem" = true
      ORDER BY (1 - "precoPromocional"::float / preco::float) DESC
      LIMIT 4
    ` as any[]

    // ── Destaque para o carousel ──
    const destaque = await prisma.$queryRaw`
      SELECT id, nome, slug, preco, "precoPromocional", imagens, estoque, marca, categoria, ativo
      FROM "Product"
      WHERE ativo = true AND estoque > 0 AND "temImagem" = true
      ORDER BY "updatedAt" DESC
      LIMIT 12
    ` as any[]

    return { destaque, promos: promos as any[], maisVendidos: maisVendidos as any[], temVendasReais }
  } catch (e) {
    console.error('[home] getHomeData error:', e)
    return { destaque: [], promos: [], maisVendidos: [], temVendasReais: false }
  }
}

// ── TireArt SVG ──────────────────────────────────────────────────────────────
function TireArt() {
  return (
    <svg width="300" height="300" viewBox="0 0 300 300" fill="none">
      <circle cx="150" cy="150" r="145" fill="rgba(212,43,43,0.04)"/>
      <circle cx="150" cy="150" r="132" stroke="rgba(255,255,255,0.1)" strokeWidth="22"/>
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2
        return (
          <line key={i}
            x1={150 + 122 * Math.cos(a)} y1={150 + 122 * Math.sin(a)}
            x2={150 + 138 * Math.cos(a)} y2={150 + 138 * Math.sin(a)}
            stroke="#fff" strokeWidth="4" opacity="0.13" strokeLinecap="round"
          />
        )
      })}
      <circle cx="150" cy="150" r="132" stroke="#d42b2b" strokeWidth="2" strokeDasharray="20 10" opacity="0.4"/>
      <circle cx="150" cy="150" r="95" stroke="rgba(255,255,255,0.18)" strokeWidth="14"/>
      <circle cx="150" cy="150" r="95" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5"/>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <line key={i}
            x1={150 + 52 * Math.cos(a)} y1={150 + 52 * Math.sin(a)}
            x2={150 + 88 * Math.cos(a)} y2={150 + 88 * Math.sin(a)}
            stroke="rgba(255,255,255,0.32)" strokeWidth="5" strokeLinecap="round"
          />
        )
      })}
      <circle cx="150" cy="150" r="52" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.18)" strokeWidth="5"/>
      <circle cx="150" cy="150" r="32" fill="rgba(0,0,0,0.5)" stroke="#d42b2b" strokeWidth="2.5" opacity="0.85"/>
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        return <circle key={i} cx={150 + 20 * Math.cos(a)} cy={150 + 20 * Math.sin(a)} r="4.5" fill="#000" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
      })}
      <circle cx="150" cy="150" r="9" fill="#d42b2b"/>
      <circle cx="150" cy="150" r="4" fill="#fff" opacity="0.6"/>
    </svg>
  )
}

const POP_CATS = [
  { id: 'Pneus',       label: 'Pneus Premium',        sub: 'Pirelli · Michelin · Bridgestone', bg: 'linear-gradient(145deg,#1a1a2e,#2a2a44)', href: '/produtos?categoria=Pneus' },
  { id: 'Lubrificantes', label: 'Óleos e Lubrificantes', sub: 'Motul · Castrol · Shell',        bg: 'linear-gradient(145deg,#1e1008,#321a0e)', href: '/produtos?categoria=Lubrificantes' },
  { id: 'Freios',      label: 'Freios e Segurança',    sub: 'EBC · Brembo · ATE',              bg: 'linear-gradient(145deg,#1e0808,#321010)', href: '/produtos?categoria=Freios' },
  { id: 'Transmissão', label: 'Transmissão',           sub: 'DID · RK · Regina',               bg: 'linear-gradient(145deg,#08121e,#102030)', href: '/produtos?categoria=Transmissão' },
  { id: 'Capacetes',   label: 'Capacetes e EPI',       sub: 'AGV · HJC · Shoei',               bg: 'linear-gradient(145deg,#0a0a1e,#14143a)', href: '/produtos?categoria=Capacetes' },
]

const BRANDS = ['PIRELLI', 'METZELER', 'MICHELIN', 'MOTUL', 'EBC', 'DID']

// Serviços do box rápido (extraído do áudio do Vinícius)
const SERVICOS = [
  {
    titulo: 'Troca de Pneu',
    sub: 'Pirelli · Metzeler · Michelin',
    tempo: '~20 min',
    icon: '🏍️',
    cor: '#d42b2b',
  },
  {
    titulo: 'Pastilha de Freio',
    sub: 'Peças originais e homologadas',
    tempo: '~15 min',
    icon: '🛑',
    cor: '#e05a00',
  },
  {
    titulo: 'Troca de Óleo',
    sub: 'Óleos certificados para motos',
    tempo: '~20 min',
    icon: '🔧',
    cor: '#0077cc',
  },
  {
    titulo: 'Kit Transmissão',
    sub: 'Corrente · Pinhão · Coroa',
    tempo: '~30 min',
    icon: '⚙️',
    cor: '#1a7a2e',
  },
]


const LOCAL_BUSINESS_LD = getLocalBusinessSchema()

export default async function HomePage() {
  const { destaque, promos, maisVendidos, temVendasReais } = await getHomeData()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_LD) }} />

      {/* ── Hero Carousel ─────────────────────────────────────────────────── */}
      <HeroCarousel />

      {/* ── TrustBar ─────────────────────────────────────────────────────── */}
      <TrustBar />

      {/* ── Mais Vendidos ────────────────────────────────────────────────── */}
      {maisVendidos.length > 0 && (
        <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '52px 0' }}>
          <div className="max-w-[1280px] mx-auto px-6 md:px-12">
            <ScrollReveal>
              <div className="flex items-end justify-between mb-7">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="font-barlow font-bold text-[11px] uppercase tracking-[1.5px] text-white px-2.5 py-1"
                      style={{ background: '#d42b2b', borderRadius: 3 }}
                    >
                      {temVendasReais ? '🔥 TOP VENDAS' : '⭐ DESTAQUE'}
                    </span>
                    <span className="text-[#aaa] text-[11px] font-inter">
                      {temVendasReais ? 'Baseado em pedidos reais' : 'Em estoque · Com imagem'}
                    </span>
                  </div>
                  <h2 className="font-barlow font-black text-[32px] md:text-[38px] text-[#111] tracking-[-0.5px] leading-[1.1]">
                    {temVendasReais ? 'MAIS VENDIDOS' : 'PRODUTOS EM DESTAQUE'}
                  </h2>
                </div>
                <Link
                  href="/produtos"
                  className="hidden md:flex items-center gap-1.5 text-[#d42b2b] text-[13px] font-inter font-medium hover:gap-2.5 transition-all"
                >
                  Ver catálogo completo <ArrowRight size={14} />
                </Link>
              </div>
            </ScrollReveal>

            {/* Grid 2→4→6 colunas */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {maisVendidos.slice(0, 12).map((p: any, i: number) => (
                <ScrollReveal key={p.id} delay={i * 40}>
                  <ProductCard produto={p} />
                </ScrollReveal>
              ))}
            </div>

            <div className="mt-6 flex justify-center md:hidden">
              <Link
                href="/produtos"
                className="flex items-center gap-2 font-barlow font-bold text-[15px] uppercase tracking-[0.5px] text-white px-7 py-3 bg-[#d42b2b] hover:bg-[#b82222] transition-colors"
                style={{ borderRadius: 4 }}
              >
                Ver todos os produtos <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Serviços Box Rápido ───────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '52px 0' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-[#d42b2b] font-barlow font-bold text-[13px] uppercase tracking-[1.5px]">Box Rápido · Campinas/SP</span>
              <h2 className="font-barlow font-black text-[32px] md:text-[40px] text-[#111] tracking-[-0.5px] leading-[1.1] mt-1">
                SERVIÇOS SEM<br />AGENDAMENTO
              </h2>
            </div>
            <div className="text-right">
              <p className="font-inter text-[13px] text-[#888] leading-[1.6] max-w-xs">
                Ferramental italiano exclusivo.<br />
                Máquinas renovadas anualmente.<br />
                <strong className="text-[#555]">Credenciada oficial Pirelli, Metzeler e Michelin.</strong>
              </p>
              <Link
                href="/agendar"
                className="inline-block mt-3 font-barlow font-bold text-[14px] uppercase tracking-[0.5px] text-[#d42b2b] hover:text-[#b82222] transition-colors"
              >
                Agendar horário →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="servicos">
            {SERVICOS.map((s, i) => (
              <ScrollReveal key={s.titulo} delay={i * 90}>
                <Link href="/agendar">
                  <div className="bg-white border border-[#eee] hover:border-[#d42b2b] hover:shadow-lg rounded-xl p-5 transition-all cursor-pointer group card-lift h-full">
                    <div className="text-3xl mb-3 transition-transform duration-300 group-hover:scale-110 inline-block">{s.icon}</div>
                    <div className="font-barlow font-bold text-[18px] text-[#111] leading-[1.2] mb-1 group-hover:text-[#d42b2b] transition-colors">
                      {s.titulo}
                    </div>
                    <div className="font-inter text-[12px] text-[#888] mb-3">{s.sub}</div>
                    <div
                      className="inline-flex items-center gap-1 text-[11px] font-barlow font-bold px-2.5 py-1 rounded-sm uppercase tracking-[0.5px] text-white"
                      style={{ background: s.cor }}
                    >
                      ⏱ {s.tempo}
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>

          {/* Diferenciais */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { titulo: '+10 Anos de Experiência', sub: 'Fundada em 2015, referência em Campinas/SP' },
              { titulo: 'Ferramental Italiano', sub: 'Máquinas de pneu renovadas anualmente com emborrachadas novas' },
              { titulo: 'Sem Agendamento', sub: 'Chegou, atendemos. Box rápido sem burocracia' },
            ].map(d => (
              <div key={d.titulo} className="flex items-start gap-4 bg-[#f9f9f9] border border-[#eee] rounded-lg p-4">
                <div className="w-2 h-2 rounded-full bg-[#d42b2b] mt-2 shrink-0" />
                <div>
                  <div className="font-barlow font-bold text-[15px] text-[#111]">{d.titulo}</div>
                  <div className="font-inter text-[12px] text-[#888] mt-0.5">{d.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PromosSection ─────────────────────────────────────────────────── */}
      {promos.length > 0 && (
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-11">
          <ScrollReveal>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[#d42b2b] font-barlow font-bold text-[12px] uppercase tracking-[1.5px] mb-1">Ofertas especiais</p>
                <h2 className="font-barlow font-bold text-[28px] text-[#111] tracking-[-0.3px]">Promoções</h2>
              </div>
              <Link href="/produtos" className="text-[#d42b2b] text-[13px] font-inter font-medium flex items-center gap-1 hover:gap-2 transition-all">
                Ver todos <ArrowRight size={13} />
              </Link>
            </div>
          </ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {promos.map((p, i) => (
              <ScrollReveal key={p.id} delay={i * 60}>
                <ProductCard produto={p} />
              </ScrollReveal>
            ))}
          </div>
        </div>
      )}

      {/* ── CategoriesSection ─────────────────────────────────────────────── */}
      <div style={{ background: '#f5f5f5', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '44px 0' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-barlow font-bold text-[26px] text-[#111] tracking-[-0.3px]">Categorias Populares</h2>
            <Link href="/produtos" className="text-[#d42b2b] text-[13px] font-inter font-medium flex items-center gap-1">
              Ver todas <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {POP_CATS.map((cat, i) => (
              <ScrollReveal key={cat.id} delay={i * 70}>
                <Link href={cat.href}>
                  <div
                    className="cat-card overflow-hidden cursor-pointer flex flex-col justify-end relative"
                    style={{
                      background: cat.bg,
                      borderRadius: 10,
                      aspectRatio: '3/4',
                      padding: '20px 16px',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)',
                      }}
                    />
                    <div className="relative z-10">
                      <div className="font-barlow font-bold text-[16px] text-white leading-[1.2] mb-1">{cat.label}</div>
                      <div className="font-inter text-[10px] leading-[1.4]" style={{ color: 'rgba(255,255,255,0.55)' }}>{cat.sub}</div>
                      <div
                        className="mt-3 text-white text-[10px] font-barlow font-bold px-2.5 py-1 inline-flex items-center gap-1 uppercase tracking-[0.5px]"
                        style={{ background: '#d42b2b', borderRadius: 3 }}
                      >
                        Explorar <ArrowRight size={10} />
                      </div>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── FeaturedCarousel ──────────────────────────────────────────────── */}
      {destaque.length > 0 && <FeaturedCarousel produtos={destaque} />}

      {/* ── RedBanner ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#d42b2b', padding: '44px 48px', textAlign: 'center' }}>
        <div className="font-barlow font-black text-[32px] md:text-[38px] text-white tracking-[-0.5px] leading-[1.1]">
          PEÇAS ORIGINAIS PARA SUA MOTO
        </div>
        <div className="font-barlow font-bold text-[20px] md:text-[22px] mt-1.5 tracking-[2px] uppercase" style={{ color: 'rgba(255,255,255,0.82)' }}>
          ENTREGA EM TODO O BRASIL
        </div>
        <Link
          href="/produtos"
          className="inline-block mt-[22px] bg-white text-[#d42b2b] font-barlow font-black text-[18px] uppercase tracking-[0.5px] px-9 py-[13px] hover:bg-[#ffe5e5] transition-colors"
          style={{ borderRadius: 3 }}
        >
          VER CATÁLOGO COMPLETO
        </Link>
      </div>

      {/* ── MarcasSection ─────────────────────────────────────────────────── */}
      <div style={{ background: '#f5f5f5', borderTop: '1px solid #eee', padding: '44px 0' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <ScrollReveal>
            <h2 className="font-barlow font-bold text-[26px] text-[#111] mb-2 tracking-[-0.3px]">Marcas Parceiras</h2>
            <p className="font-inter text-[13px] text-[#888] mb-6">Distribuidora autorizada das principais marcas do mundo</p>
          </ScrollReveal>
          <div className="flex gap-2.5 flex-wrap items-center justify-between">
            {BRANDS.map((brand, i) => (
              <ScrollReveal key={brand} delay={i * 60}>
                <div className="bg-white border border-[#eee] rounded-xl px-7 py-5 flex items-center justify-center cursor-pointer hover:border-[#d42b2b] hover:shadow-md transition-all duration-200 group card-lift min-w-[110px]">
                  <span className="font-barlow font-black text-[22px] md:text-[26px] text-[#444] tracking-[2px] group-hover:text-[#d42b2b] transition-colors">
                    {brand}
                  </span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>

      {/* ── Reviews / Depoimentos ────────────────────────────────────────── */}
      <ReviewsSection />
    </>
  )
}
