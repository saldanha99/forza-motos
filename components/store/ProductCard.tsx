'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import toast from 'react-hot-toast'

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
        className="bg-white rounded-lg overflow-hidden flex flex-col h-full transition-all duration-200"
        style={{
          border: `1.5px solid ${hov ? '#d42b2b' : '#e8e8e8'}`,
          boxShadow: hov
            ? '0 8px 28px rgba(212,43,43,0.13), 0 2px 8px rgba(0,0,0,0.06)'
            : '0 1px 4px rgba(0,0,0,0.05)',
        }}
      >
        {/* Image container — square */}
        <div className="relative w-full aspect-square overflow-hidden bg-[#f7f7f7]">
          {imagem ? (
            <Image
              src={imagem}
              alt={produto.nome}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#f2f2f2] to-[#ebebeb]">
              <TirePlaceholder />
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
            <span className="text-[10px] font-semibold text-[#999] uppercase tracking-[0.8px] mb-1 truncate">
              {produto.marca}
            </span>
          )}

          {/* Name */}
          <p className="text-[12.5px] font-medium text-[#1a1a1a] leading-[1.35] mb-2 line-clamp-2 flex-1">
            {produto.nome}
          </p>

          {/* Price */}
          <div className="mt-auto">
            {precoPromo && (
              <span className="block text-[11px] text-[#bbb] line-through leading-none mb-0.5">
                {formatPrice(preco)}
              </span>
            )}
            <span className="block font-black text-[20px] leading-none text-[#d42b2b] tracking-tight">
              {formatPrice(precoFinal)}
            </span>
            <span className="text-[10px] text-[#aaa] mt-0.5 block">
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
                border: '1.5px solid #d42b2b',
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
function TirePlaceholder() {
  return (
    <svg viewBox="0 0 100 100" width="68" height="68" fill="none">
      <circle cx="50" cy="50" r="44" stroke="#ddd" strokeWidth="9" />
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        const r1 = 28, r2 = 35
        return (
          <line
            key={i}
            x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)}
            x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)}
            stroke="#ccc" strokeWidth="3.5" strokeLinecap="round"
          />
        )
      })}
      <circle cx="50" cy="50" r="22" stroke="#e0e0e0" strokeWidth="7" />
      <circle cx="50" cy="50" r="9" fill="#eee" />
      <circle cx="50" cy="50" r="5" fill="#d42b2b" opacity="0.4" />
    </svg>
  )
}
