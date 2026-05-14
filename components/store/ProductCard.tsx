'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import toast from 'react-hot-toast'
import { useTheme } from 'next-themes'

interface Produto {
  id: string
  nome: string
  slug: string
  preco: any
  precoPromocional?: any
  imagens: any
  estoque: number
  marca: string
  categoria: string
}

export function ProductCard({ produto }: { produto: Produto }) {
  const adicionarItem = useCartStore((s) => s.adicionarItem)
  const [hov, setHov] = useState(false)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const imagens = Array.isArray(produto.imagens) ? produto.imagens : []
  const imagem = imagens[0] || null

  const preco = Number(produto.preco)
  const precoPromo = produto.precoPromocional ? Number(produto.precoPromocional) : null
  const disc = precoPromo ? Math.round((1 - precoPromo / preco) * 100) : null
  const precoFinal = precoPromo ?? preco

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    adicionarItem({ id: produto.id, nome: produto.nome, slug: produto.slug, preco: precoFinal, imagem })
    toast.success('Adicionado ao carrinho!')
  }

  const esgotado = produto.estoque === 0

  return (
    <Link href={`/produtos/${produto.slug}`} className="group block">
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="rounded-lg overflow-hidden flex flex-col h-full transition-all duration-200"
        style={{
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          border: `1.5px solid ${hov ? '#d42b2b' : isDark ? '#2e2e2e' : '#e8e8e8'}`,
          boxShadow: hov
            ? isDark
              ? '0 8px 28px rgba(212,43,43,0.2), 0 2px 8px rgba(0,0,0,0.3)'
              : '0 8px 28px rgba(212,43,43,0.13), 0 2px 8px rgba(0,0,0,0.06)'
            : isDark
              ? '0 1px 4px rgba(0,0,0,0.3)'
              : '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        {/* Image container — square */}
        <div
          className="relative w-full aspect-square overflow-hidden"
          style={{ backgroundColor: isDark ? '#252525' : '#f7f7f7' }}
        >
          {imagem ? (
            <Image
              src={imagem}
              alt={produto.nome}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: isDark
                  ? 'linear-gradient(135deg, #242424 0%, #1c1c1c 100%)'
                  : 'linear-gradient(135deg, #f2f2f2 0%, #ebebeb 100%)',
              }}
            >
              <TirePlaceholder dark={isDark} />
            </div>
          )}

          {/* Badges */}
          {disc && disc >= 5 && (
            <span className="absolute top-2 left-2 bg-[#d42b2b] text-white text-[11px] font-bold px-2 py-0.5 rounded-sm tracking-wide">
              -{disc}%
            </span>
          )}
          {esgotado && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-xs text-white font-bold bg-black/60 px-3 py-1.5 rounded uppercase tracking-widest">
                Esgotado
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-3">
          {/* Brand */}
          {produto.marca && (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.8px] mb-1 truncate"
              style={{ color: isDark ? '#666' : '#999' }}
            >
              {produto.marca}
            </span>
          )}

          {/* Name */}
          <p
            className="text-[12.5px] font-medium leading-[1.35] mb-2 line-clamp-2 flex-1"
            style={{ color: isDark ? '#e0e0e0' : '#1a1a1a' }}
          >
            {produto.nome}
          </p>

          {/* Price */}
          <div className="mt-auto">
            {precoPromo && (
              <span
                className="block text-[11px] line-through leading-none mb-0.5"
                style={{ color: isDark ? '#555' : '#bbb' }}
              >
                {formatPrice(preco)}
              </span>
            )}
            <span className="block font-black text-[20px] leading-none text-[#d42b2b] tracking-tight">
              {formatPrice(precoFinal)}
            </span>
            <span
              className="text-[10px] mt-0.5 block"
              style={{ color: isDark ? '#555' : '#aaa' }}
            >
              ou {formatPrice(precoFinal / 12)}/mês no cartão
            </span>
          </div>

          {/* CTA */}
          {!esgotado && (
            <button
              onClick={handleAddToCart}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded text-[12px] font-bold uppercase tracking-[0.4px] transition-all duration-200"
              style={{
                background: hov ? '#d42b2b' : 'transparent',
                color: hov ? '#fff' : '#d42b2b',
                border: `1.5px solid ${isDark ? '#e03333' : '#d42b2b'}`,
              }}
            >
              <ShoppingCart size={13} strokeWidth={2.5} />
              Comprar
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}

/** Placeholder SVG estilo pneu — menor, mais elegante */
function TirePlaceholder({ dark = false }: { dark?: boolean }) {
  const ring = dark ? '#3a3a3a' : '#ddd'
  const spoke = dark ? '#333' : '#ccc'
  const hub = dark ? '#2e2e2e' : '#e0e0e0'
  const center = dark ? '#2a2a2a' : '#eee'
  return (
    <svg viewBox="0 0 100 100" width="68" height="68" fill="none">
      <circle cx="50" cy="50" r="44" stroke={ring} strokeWidth="9" />
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        const r1 = 28, r2 = 35
        return (
          <line
            key={i}
            x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)}
            x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)}
            stroke={spoke} strokeWidth="3.5" strokeLinecap="round"
          />
        )
      })}
      <circle cx="50" cy="50" r="22" stroke={hub} strokeWidth="7" />
      <circle cx="50" cy="50" r="9" fill={center} />
      <circle cx="50" cy="50" r="5" fill="#d42b2b" opacity="0.4" />
    </svg>
  )
}
