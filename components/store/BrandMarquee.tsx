'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  LogoPirelli,
  LogoMichelin,
  LogoMetzeler,
  LogoBridgestone,
  LogoMotul,
  LogoEBC,
  LogoDID,
} from './BrandLogo'

interface BrandItem {
  key: string
  Logo: React.ComponentType<{ height?: number; className?: string }>
  h: number
  bg?: string
}

const BRANDS: BrandItem[] = [
  { key: 'pirelli',     Logo: LogoPirelli,     h: 30 },
  { key: 'michelin',    Logo: LogoMichelin,    h: 32 },
  { key: 'metzeler',   Logo: LogoMetzeler,    h: 22 },
  { key: 'bridgestone', Logo: LogoBridgestone, h: 22 },
  { key: 'motul',       Logo: LogoMotul,       h: 34, bg: '#EE1C25' },
  { key: 'ebc',         Logo: LogoEBC,         h: 34 },
  { key: 'did',         Logo: LogoDID,         h: 30 },
]

// Faixa 2 usa as marcas em ordem diferente para não espelhar
const BRANDS_REVERSE = [...BRANDS].reverse()

function LogoCard({ brand, dark }: { brand: BrandItem; dark?: boolean }) {
  const { Logo, h, bg } = brand
  const cardBg = bg
    ? bg
    : dark
    ? '#1e1e1e'
    : '#ffffff'
  const borderColor = bg ? 'transparent' : dark ? '#2e2e2e' : '#e8e8e8'

  return (
    <div
      style={{
        background: cardBg,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 12,
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 80,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <Logo height={h} />
    </div>
  )
}

export function BrandMarquee() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'
  // Duplicamos as listas para criar o loop sem salto visível
  const col1 = [...BRANDS, ...BRANDS]
  const col2 = [...BRANDS_REVERSE, ...BRANDS_REVERSE]

  return (
    <section
      style={{
        background: dark ? '#0f0f0f' : '#f5f5f5',
        borderTop: `1px solid ${dark ? '#2a2a2a' : '#eeeeee'}`,
        borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eeeeee'}`,
        padding: '52px 0',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes brand-scroll-up {
          0%   { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        @keyframes brand-scroll-down {
          0%   { transform: translateY(-50%); }
          100% { transform: translateY(0); }
        }
      `}</style>

      <div className="max-w-[1280px] mx-auto px-6 md:px-12">
        {/* Título */}
        <div className="mb-10">
          <h2
            className="font-barlow font-bold text-[26px] tracking-[-0.3px]"
            style={{ color: dark ? '#f0f0f0' : '#111' }}
          >
            Marcas Parceiras
          </h2>
          <p
            className="font-inter text-[13px] mt-1"
            style={{ color: dark ? '#666' : '#888' }}
          >
            Distribuidor autorizado das principais marcas do mundo
          </p>
        </div>

        {/* Duas colunas com scroll vertical */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            height: 380,
            overflow: 'hidden',
            maskImage:
              'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
          }}
        >
          {/* Coluna A — sobe */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              animation: 'brand-scroll-up 20s linear infinite',
              willChange: 'transform',
            }}
          >
            {col1.map((brand, i) => (
              <LogoCard key={`a-${brand.key}-${i}`} brand={brand} dark={dark} />
            ))}
          </div>

          {/* Coluna B — desce */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              animation: 'brand-scroll-down 24s linear infinite',
              willChange: 'transform',
            }}
          >
            {col2.map((brand, i) => (
              <LogoCard key={`b-${brand.key}-${i}`} brand={brand} dark={dark} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
