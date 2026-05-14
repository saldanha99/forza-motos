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
    <Link href={`/produtos/${produto.slug}`} className="group block h-full">
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="rounded-lg overflow-hidden flex flex-col h-full transition-all duration-200"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: `1.5px solid ${hov ? 'var(--vermelho)' : 'var(--card-border)'}`,
          boxShadow: hov
            ? '0 8px 28px rgba(212,43,43,0.18), 0 2px 8px rgba(0,0,0,0.15)'
            : '0 1px 4px rgba(0,0,0,0.08)',
        }}
      >
        {/* ── Imagem ────────────────────────────────────────── */}
        <div
          className="relative w-full aspect-square overflow-hidden"
          style={{ backgroundColor: 'var(--card-img-bg)' }}
        >
          {imagem ? (
            <Image
              src={imagem}
              alt={produto.nome}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--card-placeholder-from) 0%, var(--card-placeholder-to) 100%)',
              }}
            >
              <TirePlaceholder />
            </div>
          )}

          {/* Desconto */}
          {disc && disc >= 5 && (
            <span className="absolute top-2 left-2 bg-[#d42b2b] text-white text-[11px] font-bold px-2 py-0.5 rounded-sm tracking-wide">
              -{disc}%
            </span>
          )}

          {/* Esgotado */}
          {esgotado && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-xs text-white font-bold bg-black/60 px-3 py-1.5 rounded uppercase tracking-widest">
                Esgotado
              </span>
            </div>
          )}
        </div>

        {/* ── Conteúdo ──────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-3">
          {/* Marca */}
          {produto.marca && (
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.8px] mb-1 truncate"
              style={{ color: 'var(--card-brand)' }}
            >
              {produto.marca}
            </span>
          )}

          {/* Nome */}
          <p
            className="text-[12.5px] font-medium leading-[1.35] mb-2 line-clamp-2 flex-1"
            style={{ color: 'var(--card-text)' }}
          >
            {produto.nome}
          </p>

          {/* Preço */}
          <div className="mt-auto">
            {precoPromo && (
              <span
                className="block text-[11px] line-through leading-none mb-0.5"
                style={{ color: 'var(--card-old-price)' }}
              >
                {formatPrice(preco)}
              </span>
            )}
            <span className="block font-black text-[20px] leading-none tracking-tight" style={{ color: 'var(--vermelho)' }}>
              {formatPrice(precoFinal)}
            </span>
            <span
              className="text-[10px] mt-0.5 block"
              style={{ color: 'var(--card-installment)' }}
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
                background: hov ? 'var(--vermelho)' : 'transparent',
                color: hov ? '#fff' : 'var(--vermelho)',
                border: '1.5px solid var(--vermelho)',
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

/** Placeholder pneu — usa CSS variables para cores */
function TirePlaceholder() {
  return (
    <svg viewBox="0 0 100 100" width="68" height="68" fill="none">
      <circle cx="50" cy="50" r="44" stroke="var(--line-hi)" strokeWidth="9" />
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        const r1 = 28, r2 = 35
        return (
          <line
            key={i}
            x1={50 + r1 * Math.cos(a)} y1={50 + r1 * Math.sin(a)}
            x2={50 + r2 * Math.cos(a)} y2={50 + r2 * Math.sin(a)}
            stroke="var(--line-hi)" strokeWidth="3.5" strokeLinecap="round"
          />
        )
      })}
      <circle cx="50" cy="50" r="22" stroke="var(--card-hi)" strokeWidth="7" />
      <circle cx="50" cy="50" r="9" fill="var(--card-hi)" />
      <circle cx="50" cy="50" r="5" fill="#d42b2b" opacity="0.5" />
    </svg>
  )
}
