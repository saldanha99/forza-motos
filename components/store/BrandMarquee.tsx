'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import {
  LogoPirelli,
  LogoMetzeler,
  LogoMotul,
  LogoEBC,
  LogoDID,
} from './BrandLogo'

interface BrandItem {
  key: string
  Logo: React.ComponentType<{ height?: number; className?: string }>
  h: number
  bg?: string   // fundo customizado (ex: Motul vermelho)
}

// Michelin volta ao ticker quando o Caio enviar o logo atualizado (substituir /images/brands/michelin.svg)
const BRANDS: BrandItem[] = [
  { key: 'pirelli',     Logo: LogoPirelli,     h: 28 },
  { key: 'metzeler',    Logo: LogoMetzeler,    h: 20 },
  { key: 'motul',       Logo: LogoMotul,       h: 32, bg: '#EE1C25' },
  { key: 'ebc',         Logo: LogoEBC,         h: 32 },
  { key: 'did',         Logo: LogoDID,         h: 28 },
]

export function BrandMarquee() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'

  // Triplicamos para garantir loop suave sem gaps
  const track = [...BRANDS, ...BRANDS, ...BRANDS]

  const sectionBg  = dark ? '#0a0a0a' : '#f5f5f5'
  const borderCol  = dark ? '#1e1e1e' : '#e8e8e8'
  // Cards sem bg customizado sempre ficam brancos (dark ou light)
  // assim os logos ficam legíveis independente do tema
  const cardBg     = (bg?: string) => bg ? bg : '#ffffff'
  const cardBorder = (bg?: string) => bg ? 'transparent' : '#e8e8e8'
  const titleCol   = dark ? '#f0f0f0' : '#111111'
  const subtitleCol = dark ? '#555' : '#999'

  return (
    <section
      style={{
        background: sectionBg,
        borderTop:    `1px solid ${borderCol}`,
        borderBottom: `1px solid ${borderCol}`,
        padding: '48px 0',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes ticker-left {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>

      {/* Título */}
      <div className="max-w-[1280px] mx-auto px-6 md:px-12 mb-8">
        <h2
          className="font-barlow font-bold text-[26px] tracking-[-0.3px]"
          style={{ color: titleCol }}
        >
          Marcas Parceiras
        </h2>
        <p className="font-inter text-[13px] mt-0.5" style={{ color: subtitleCol }}>
          Distribuidor autorizado das principais marcas do mundo
        </p>
      </div>

      {/* Ticker horizontal */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          /* Ofusca as bordas esquerda e direita */
          maskImage: `linear-gradient(
            to right,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          )`,
          WebkitMaskImage: `linear-gradient(
            to right,
            transparent 0%,
            black 8%,
            black 92%,
            transparent 100%
          )`,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 16,
            width: 'max-content',
            animation: 'ticker-left 35s linear infinite',
            willChange: 'transform',
          }}
        >
          {track.map((brand, i) => (
            <div
              key={`${brand.key}-${i}`}
              style={{
                background:   cardBg(brand.bg),
                border:       `1.5px solid ${cardBorder(brand.bg)}`,
                borderRadius: 10,
                padding:      '14px 28px',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                height:       72,
                minWidth:     140,
                flexShrink:   0,
                boxSizing:    'border-box',
              }}
            >
              <brand.Logo height={brand.h} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
