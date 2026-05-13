import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { FeaturedCarousel } from '@/components/store/FeaturedCarousel'
import { ArrowRight } from 'lucide-react'

async function getHomeData() {
  try {
    const [destaque, promos] = await Promise.all([
      prisma.product.findMany({
        where: { ativo: true, estoque: { gt: 0 } },
        take: 12,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.findMany({
        where: { ativo: true, estoque: { gt: 0 }, NOT: { precoPromocional: null } },
        take: 4,
        orderBy: { createdAt: 'desc' },
      }),
    ])
    return { destaque, promos }
  } catch {
    return { destaque: [], promos: [] }
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

const TRUST = [
  {
    title: 'Entrega Brasil',
    sub: 'Em todo o território nacional',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="1" y="6" width="20" height="16" rx="2" stroke="#d42b2b" strokeWidth="2"/>
        <path d="M21 11h6l4 6v6h-10V11z" stroke="#d42b2b" strokeWidth="2"/>
        <circle cx="8" cy="25" r="3" stroke="#d42b2b" strokeWidth="2"/>
        <circle cx="24" cy="25" r="3" stroke="#d42b2b" strokeWidth="2"/>
      </svg>
    ),
  },
  {
    title: 'Envio em 24h',
    sub: 'Despacho no mesmo dia',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="13" stroke="#d42b2b" strokeWidth="2"/>
        <polyline points="16 8 16 16 21 19" stroke="#d42b2b" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    title: 'Pagamento Seguro',
    sub: 'Compra 100% protegida',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M16 2l3.5 7 7.7 1.1-5.6 5.4 1.3 7.7L16 20.5l-6.9 3.6 1.3-7.7L4.8 10.1l7.7-1.1L16 2z" stroke="#d42b2b" strokeWidth="2" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    title: 'Troca Fácil',
    sub: '30 dias para troca ou devolução',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M26 14c0 8-10 16-10 16S6 22 6 14a10 10 0 0120 0z" stroke="#d42b2b" strokeWidth="2"/>
        <path d="M11 14l3.5 3.5L21 11" stroke="#d42b2b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
]

export default async function HomePage() {
  const { destaque, promos } = await getHomeData()

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg,#0c0c0c 0%,#181818 55%,#0c0c0c 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* grid texture */}
        <div
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)',
            backgroundSize: '60px 60px',
            pointerEvents: 'none',
          }}
        />

        <div className="max-w-[1280px] mx-auto grid md:grid-cols-2 min-h-[420px] px-6 md:px-12 relative z-10">
          {/* Left: tire art */}
          <div className="flex items-center justify-center py-10 relative">
            <div
              style={{
                position: 'absolute', width: 320, height: 320, borderRadius: '50%',
                background: 'radial-gradient(circle,rgba(212,43,43,0.12) 0%,transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            <TireArt />

            {/* Floating badges */}
            <div
              className="absolute hidden md:block"
              style={{ top: '18%', left: '6%', background: 'rgba(255,255,255,0.07)', borderRadius: 6, padding: '8px 14px', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="text-[#777] text-[10px] font-inter">Credenciada</div>
              <div className="text-white text-[14px] font-barlow font-bold">PIRELLI · MICHELIN</div>
            </div>

            <div
              className="absolute hidden md:block"
              style={{ bottom: '22%', right: '6%', background: 'rgba(212,43,43,0.14)', borderRadius: 6, padding: '8px 14px', border: '1px solid rgba(212,43,43,0.28)' }}
            >
              <div className="text-[#777] text-[10px] font-inter">Box rápido</div>
              <div className="text-[#d42b2b] text-[16px] font-barlow font-black">30 MINUTOS</div>
            </div>
          </div>

          {/* Right: info */}
          <div className="py-12 md:pl-10 flex flex-col justify-center gap-[18px]">
            {/* Badges */}
            <div className="flex gap-2 items-center flex-wrap">
              <span
                className="text-white text-[11px] font-barlow font-bold px-3 py-1 uppercase tracking-[1px]"
                style={{ background: '#d42b2b', borderRadius: 2 }}
              >
                BOX RÁPIDO
              </span>
              <span className="text-[#555] text-[11px] font-inter">Campinas / SP</span>
            </div>

            {/* Headline */}
            <div>
              <h1
                className="font-barlow font-black text-[46px] md:text-[52px] text-white leading-[1.05] tracking-[-0.5px]"
              >
                PNEUS E PEÇAS<br />
                <span style={{ color: '#d42b2b' }}>PARA SUA MOTO</span>
              </h1>
              <p className="font-inter text-[13px] text-[#666] mt-3 leading-[1.6]">
                Credenciada Pirelli, Metzeler e Michelin&nbsp;·&nbsp;Campinas/SP<br />
                Troca de pneu em até 30 minutos, sem agendamento
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-3 flex-wrap mt-1">
              <Link
                href="/produtos"
                className="inline-block font-barlow font-bold text-[19px] uppercase tracking-[0.5px] text-white px-8 py-[14px] bg-[#d42b2b] hover:bg-[#b82222] transition-colors"
                style={{ borderRadius: 3 }}
              >
                VER PRODUTOS
              </Link>
              <Link
                href="/agendar"
                className="inline-block font-barlow font-bold text-[17px] uppercase tracking-[0.3px] text-[#bbb] px-6 py-[14px] hover:border-white/40 transition-colors"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 3 }}
              >
                AGENDAR SERVIÇO
              </Link>
            </div>
          </div>
        </div>

        {/* slide dots */}
        <div className="flex gap-1.5 justify-center pb-4 relative z-10">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{ width: i === 0 ? 22 : 8, height: 8, borderRadius: 4, background: i === 0 ? '#d42b2b' : 'rgba(255,255,255,0.2)' }}
            />
          ))}
        </div>
      </div>

      {/* ── TrustBar ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#f9f9f9', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', padding: '28px 0' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {TRUST.map(({ title, sub, icon }) => (
            <div key={title} className="flex items-center gap-4">
              {icon}
              <div>
                <div className="font-barlow font-bold text-[16px] text-[#111]">{title}</div>
                <div className="font-inter text-[12px] text-[#888] mt-0.5">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SERVICOS.map((s) => (
              <Link key={s.titulo} href="/agendar">
                <div
                  className="bg-white border border-[#eee] hover:border-[#d42b2b] hover:shadow-md rounded-lg p-5 transition-all cursor-pointer group"
                >
                  <div className="text-3xl mb-3">{s.icon}</div>
                  <div className="font-barlow font-bold text-[18px] text-[#111] leading-[1.2] mb-1 group-hover:text-[#d42b2b] transition-colors">
                    {s.titulo}
                  </div>
                  <div className="font-inter text-[12px] text-[#888] mb-3">{s.sub}</div>
                  <div
                    className="inline-flex items-center gap-1 text-[11px] font-barlow font-bold px-2.5 py-1 rounded-sm uppercase tracking-[0.5px] text-white"
                    style={{ background: s.cor, opacity: 0.9 }}
                  >
                    ⏱ {s.tempo}
                  </div>
                </div>
              </Link>
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
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-barlow font-bold text-[26px] text-[#111] tracking-[-0.3px]">Promoções</h2>
            <Link href="/produtos" className="text-[#d42b2b] text-[13px] font-inter font-medium flex items-center gap-1">
              Ver todos <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {promos.map((p) => (
              <ProductCard key={p.id} produto={p} />
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
            {POP_CATS.map((cat) => (
              <Link key={cat.id} href={cat.href}>
                <div
                  className="overflow-hidden cursor-pointer flex flex-col justify-end relative transition-all duration-[180ms] hover:-translate-y-1"
                  style={{
                    background: cat.bg,
                    borderRadius: 6,
                    aspectRatio: '3/4',
                    padding: '20px 16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  {/* overlay */}
                  <div
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 60%, transparent 100%)',
                    }}
                  />
                  <div className="relative z-10">
                    <div className="font-barlow font-bold text-[16px] text-white leading-[1.2] mb-1">{cat.label}</div>
                    <div className="font-inter text-[10px] leading-[1.4]" style={{ color: 'rgba(255,255,255,0.6)' }}>{cat.sub}</div>
                    <div
                      className="mt-2.5 text-white text-[10px] font-barlow font-bold px-2.5 py-1 inline-block uppercase tracking-[0.5px]"
                      style={{ background: '#d42b2b', borderRadius: 2 }}
                    >
                      Explorar
                    </div>
                  </div>
                </div>
              </Link>
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
      <div style={{ background: '#f5f5f5', borderTop: '1px solid #eee', padding: '36px 0' }}>
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <h2 className="font-barlow font-bold text-[26px] text-[#111] mb-6 tracking-[-0.3px]">Marcas</h2>
          <div className="flex gap-2 flex-wrap items-center justify-between">
            {BRANDS.map((brand) => (
              <div
                key={brand}
                className="bg-white border border-[#eee] rounded-[6px] px-7 py-[18px] flex items-center justify-center flex-1 min-w-[100px] cursor-pointer hover:border-[#d42b2b] hover:shadow-sm transition-all"
              >
                <span className="font-barlow font-black text-[24px] md:text-[28px] text-[#333] tracking-[2px]">
                  {brand}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
