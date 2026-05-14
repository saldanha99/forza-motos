'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// ── Tire SVG animado ──────────────────────────────────────────────────────────
function AnimatedTire({ size = 260 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 260 260" fill="none" className="tire-spin">
      {/* outer ring */}
      <circle cx="130" cy="130" r="124" fill="rgba(212,43,43,0.05)" />
      <circle cx="130" cy="130" r="120" stroke="rgba(255,255,255,0.08)" strokeWidth="20" />
      {/* tread bumps */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2
        return (
          <rect
            key={i}
            x={130 + 106 * Math.cos(a) - 3}
            y={130 + 106 * Math.sin(a) - 7}
            width="6"
            height="14"
            rx="2"
            fill="#d42b2b"
            opacity="0.55"
            transform={`rotate(${(i / 24) * 360} ${130 + 106 * Math.cos(a)} ${130 + 106 * Math.sin(a)})`}
          />
        )
      })}
      {/* dash ring */}
      <circle cx="130" cy="130" r="112" stroke="#d42b2b" strokeWidth="1.5" strokeDasharray="18 8" opacity="0.35" />
      {/* inner sidewall */}
      <circle cx="130" cy="130" r="82" stroke="rgba(255,255,255,0.12)" strokeWidth="12" />
      {/* spokes */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2
        return (
          <line
            key={i}
            x1={130 + 42 * Math.cos(a)} y1={130 + 42 * Math.sin(a)}
            x2={130 + 76 * Math.cos(a)} y2={130 + 76 * Math.sin(a)}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        )
      })}
      {/* hub */}
      <circle cx="130" cy="130" r="42" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.14)" strokeWidth="4" />
      <circle cx="130" cy="130" r="26" fill="rgba(0,0,0,0.6)" stroke="#d42b2b" strokeWidth="2.5" />
      {/* lug nuts */}
      {Array.from({ length: 5 }).map((_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2
        return <circle key={i} cx={130 + 16 * Math.cos(a)} cy={130 + 16 * Math.sin(a)} r="3.5" fill="#111" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      })}
      <circle cx="130" cy="130" r="8" fill="#d42b2b" />
      <circle cx="130" cy="130" r="3.5" fill="rgba(255,255,255,0.7)" />
    </svg>
  )
}

// ── Slides ────────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    id: 'pneus',
    badge: 'BOX RÁPIDO',
    badgeSub: 'Campinas / SP',
    headline: ['PNEUS E PEÇAS', 'PARA SUA MOTO'],
    accent: 'PARA SUA MOTO',
    sub: 'Credenciada Pirelli, Metzeler e Michelin\nTroca de pneu em até 30 minutos, sem agendamento',
    cta: { label: 'VER PRODUTOS', href: '/produtos' },
    ctaSecond: { label: 'AGENDAR SERVIÇO', href: '/agendar' },
    visual: 'tire',
    bgImg: '/images/hero/slide-pneus.jpg',
    accent1: { label: 'Credenciada', value: 'PIRELLI · MICHELIN' },
    accent2: { label: 'Box rápido', value: '30 MINUTOS' },
  },
  {
    id: 'servicos',
    badge: 'SEM AGENDAMENTO',
    badgeSub: 'Chegou, atendemos',
    headline: ['MANUTENÇÃO', 'NO BOX RÁPIDO'],
    accent: 'NO BOX RÁPIDO',
    sub: 'Pneu, freio, óleo e transmissão\nFerramental italiano exclusivo',
    cta: { label: 'AGENDAR AGORA', href: '/agendar' },
    ctaSecond: { label: 'VER SERVIÇOS', href: '/#servicos' },
    visual: 'services',
    bgImg: '/images/hero/slide-servicos.jpg',
    accent1: { label: '+10 anos', value: 'EXPERIÊNCIA' },
    accent2: { label: 'Tempo médio', value: '~20 MIN' },
  },
  {
    id: 'entrega',
    badge: 'LOJA ONLINE',
    badgeSub: 'Entrega em todo Brasil',
    headline: ['PEÇAS ORIGINAIS', 'ENTREGA EM 24H'],
    accent: 'ENTREGA EM 24H',
    sub: 'Mais de 2.800 produtos em estoque\nFrete grátis acima de R$299',
    cta: { label: 'COMPRAR AGORA', href: '/produtos' },
    ctaSecond: { label: 'VER PROMOÇÕES', href: '/produtos?promo=1' },
    visual: 'brands',
    bgImg: '/images/hero/slide-entrega.jpg',
    accent1: { label: 'Frete grátis', value: 'ACIMA R$299' },
    accent2: { label: 'Parcelas', value: 'ATÉ 12×' },
  },
]

const SERVICE_CARDS = [
  { icon: '🏍️', label: 'Pneu', time: '~20min' },
  { icon: '🛑', label: 'Freio', time: '~15min' },
  { icon: '🔧', label: 'Óleo', time: '~20min' },
  { icon: '⚙️', label: 'Corrente', time: '~30min' },
]

const BRAND_NAMES = ['PIRELLI', 'METZELER', 'MICHELIN', 'MOTUL', 'EBC', 'DID']

// ── Visual right panel ────────────────────────────────────────────────────────
function SlideVisual({ type, active }: { type: string; active: boolean }) {
  if (type === 'tire') return (
    <div className="relative flex items-center justify-center h-full">
      <div
        style={{
          position: 'absolute', width: 340, height: 340, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,43,43,0.14) 0%, transparent 70%)',
          animation: active ? 'pulse-glow 3s ease-in-out infinite' : 'none',
        }}
      />
      <div style={{ animation: active ? 'spin-slow 18s linear infinite' : 'none' }}>
        <AnimatedTire size={240} />
      </div>
      {/* floating badge 1 */}
      <div
        className="absolute hidden md:block slide-badge-1"
        style={{
          top: '12%', left: '2%',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8, padding: '10px 16px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)',
          animation: active ? 'float-up 3.2s ease-in-out infinite' : 'none',
        }}
      >
        <div className="text-[#666] text-[10px] font-inter">Credenciada</div>
        <div className="text-white text-[13px] font-barlow font-bold tracking-wide">PIRELLI · MICHELIN</div>
      </div>
      {/* floating badge 2 */}
      <div
        className="absolute hidden md:block"
        style={{
          bottom: '16%', right: '2%',
          background: 'rgba(212,43,43,0.15)',
          borderRadius: 8, padding: '10px 16px',
          border: '1px solid rgba(212,43,43,0.3)',
          animation: active ? 'float-up 3.2s ease-in-out infinite 1.6s' : 'none',
        }}
      >
        <div className="text-[#888] text-[10px] font-inter">Box rápido</div>
        <div className="text-[#d42b2b] text-[18px] font-barlow font-black">30 MINUTOS</div>
      </div>
    </div>
  )

  if (type === 'services') return (
    <div className="flex items-center justify-center h-full px-4">
      <div className="grid grid-cols-2 gap-3 w-full max-w-[280px]">
        {SERVICE_CARDS.map((s, i) => (
          <div
            key={s.label}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '18px 14px',
              textAlign: 'center',
              animation: active ? `fade-up 0.5s ease ${i * 0.1 + 0.2}s both` : 'none',
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 8 }}>{s.icon}</div>
            <div className="text-white text-[13px] font-barlow font-bold">{s.label}</div>
            <div
              style={{
                marginTop: 6, fontSize: 11, fontFamily: 'var(--font-inter)',
                background: '#d42b2b', color: '#fff', borderRadius: 3,
                padding: '2px 8px', display: 'inline-block', fontWeight: 600,
              }}
            >
              {s.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // brands
  return (
    <div className="flex items-center justify-center h-full px-4">
      <div className="w-full max-w-[280px]">
        <div className="grid grid-cols-2 gap-2.5">
          {BRAND_NAMES.map((brand, i) => (
            <div
              key={brand}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '14px 10px',
                textAlign: 'center',
                animation: active ? `fade-up 0.5s ease ${i * 0.08 + 0.15}s both` : 'none',
              }}
            >
              <span className="font-barlow font-black text-[16px] text-white tracking-[1.5px]">{brand}</span>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 14, textAlign: 'center',
            padding: '12px', background: 'rgba(212,43,43,0.1)',
            border: '1px solid rgba(212,43,43,0.25)', borderRadius: 8,
            animation: active ? 'fade-up 0.5s ease 0.6s both' : 'none',
          }}
        >
          <span className="text-[#d42b2b] font-barlow font-bold text-[13px] tracking-[0.5px]">
            + 2.800 PRODUTOS
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function HeroCarousel() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')

  const goTo = useCallback((idx: number, dir: 'next' | 'prev' = 'next') => {
    if (animating) return
    setAnimating(true)
    setDirection(dir)
    setTimeout(() => {
      setCurrent(idx)
      setAnimating(false)
    }, 400)
  }, [animating])

  const next = useCallback(() => goTo((current + 1) % SLIDES.length, 'next'), [current, goTo])
  const prev = useCallback(() => goTo((current - 1 + SLIDES.length) % SLIDES.length, 'prev'), [current, goTo])

  // Auto-advance
  useEffect(() => {
    const t = setInterval(next, 5500)
    return () => clearInterval(t)
  }, [next])

  const slide = SLIDES[current]

  return (
    <>
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-glow { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.05); } }
        @keyframes float-up { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
        @keyframes fade-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slide-in-right { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slide-in-left { from { opacity:0; transform:translateX(-40px); } to { opacity:1; transform:translateX(0); } }
        @keyframes slide-out-left { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(-40px); } }
        @keyframes hero-text { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        .hero-content-enter { animation: ${direction === 'next' ? 'slide-in-right' : 'slide-in-left'} 0.45s ease both; }
        .progress-bar { animation: progress-fill 5.5s linear both; }
        @keyframes progress-fill { from { width: 0%; } to { width: 100%; } }
        .dot-pulse { animation: dot-scale 0.3s ease both; }
        @keyframes dot-scale { from { transform:scale(0.7); } to { transform:scale(1); } }
      `}</style>

      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: 480,
        }}
      >
        {/* Background image com transição */}
        {SLIDES.map((s, i) => (
          <div
            key={s.id}
            style={{
              position: 'absolute', inset: 0,
              opacity: i === current ? 1 : 0,
              transition: 'opacity 0.8s ease',
              zIndex: 0,
            }}
          >
            <Image
              src={s.bgImg}
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
              priority={i === 0}
            />
          </div>
        ))}

        {/* Overlay escuro para legibilidade do texto */}
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
            background: 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.3) 100%)',
          }}
        />

        {/* Grid texture */}
        <div
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),' +
              'linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />

        {/* Red accent line top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#d42b2b', opacity: 0.9, zIndex: 3 }} />

        {/* Content */}
        <div
          key={current}
          className={`hero-content-enter max-w-[1280px] mx-auto grid md:grid-cols-2 px-6 md:px-12`}
          style={{ minHeight: 460, position: 'relative', zIndex: 10 }}
        >
          {/* LEFT */}
          <div className="py-12 flex flex-col justify-center gap-5">
            {/* Badge row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="font-barlow font-bold text-[11px] uppercase tracking-[1.5px] text-white px-3 py-1"
                style={{ background: '#d42b2b', borderRadius: 2 }}
              >
                {slide.badge}
              </span>
              <span className="text-[#555] text-[11px] font-inter">{slide.badgeSub}</span>
            </div>

            {/* Headline */}
            <div>
              <h1 className="font-barlow font-black leading-[1.0] tracking-[-0.5px]"
                style={{ fontSize: 'clamp(36px, 5vw, 58px)', color: '#fff' }}>
                {slide.headline[0]}<br />
                <span style={{ color: '#d42b2b' }}>{slide.headline[1]}</span>
              </h1>
              <p className="font-inter text-[13px] text-[#555] mt-4 leading-[1.7]"
                style={{ whiteSpace: 'pre-line' }}>
                {slide.sub}
              </p>
            </div>

            {/* CTAs */}
            <div className="flex gap-3 flex-wrap">
              <Link
                href={slide.cta.href}
                className="font-barlow font-bold uppercase tracking-[0.5px] text-white px-8 py-[14px] bg-[#d42b2b] hover:bg-[#b82222] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ borderRadius: 3, fontSize: 18 }}
              >
                {slide.cta.label}
              </Link>
              <Link
                href={slide.ctaSecond.href}
                className="font-barlow font-bold uppercase tracking-[0.3px] text-[#bbb] px-6 py-[14px] hover:text-white hover:border-white/40 transition-all duration-200"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, fontSize: 16 }}
              >
                {slide.ctaSecond.label}
              </Link>
            </div>

            {/* Stats */}
            <div className="flex gap-6 pt-2">
              <div>
                <div className="font-barlow font-black text-[22px] text-white leading-none">{slide.accent1.value}</div>
                <div className="font-inter text-[11px] text-[#555] mt-0.5">{slide.accent1.label}</div>
              </div>
              <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div className="font-barlow font-black text-[22px] text-[#d42b2b] leading-none">{slide.accent2.value}</div>
                <div className="font-inter text-[11px] text-[#555] mt-0.5">{slide.accent2.label}</div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="hidden md:block relative" style={{ minHeight: 400 }}>
            <SlideVisual type={slide.visual} active={!animating} />
          </div>
        </div>

        {/* ── Controls ── */}
        {/* Prev / Next arrows */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}
          aria-label="Anterior"
        >
          <ChevronLeft size={18} className="text-white" />
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}
          aria-label="Próximo"
        >
          <ChevronRight size={18} className="text-white" />
        </button>

        {/* Dots + progress */}
        <div className="relative z-30 flex flex-col items-center gap-2 pb-5">
          <div className="flex gap-2 items-center">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i, i > current ? 'next' : 'prev')}
                aria-label={`Slide ${i + 1}`}
                style={{
                  height: 7, borderRadius: 4,
                  width: i === current ? 28 : 7,
                  background: i === current ? '#d42b2b' : 'rgba(255,255,255,0.2)',
                  border: 'none', cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </div>
          {/* Progress bar for current slide */}
          <div style={{ width: 60, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1, overflow: 'hidden' }}>
            <div
              key={current}
              className="progress-bar"
              style={{ height: '100%', background: '#d42b2b', borderRadius: 1 }}
            />
          </div>
        </div>
      </div>
    </>
  )
}
