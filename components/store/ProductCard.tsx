'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'

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
  /** Produto-pai de variações de tamanho: card mostra "a partir de" + escolher tamanho */
  ehPai?: boolean
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
  }

  const esgotado = produto.estoque === 0

  return (
    <Link href={`/produtos/${produto.slug}`} className="group block h-full">
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="rounded-2xl overflow-hidden flex flex-col h-full transition-all duration-300"
        style={{
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: hov ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.60)',
          border: hov
            ? '1px solid rgba(212,43,43,0.40)'
            : '1px solid rgba(255,255,255,0.40)',
          boxShadow: hov
            ? '0 12px 40px rgba(212,43,43,0.15), 0 4px 16px rgba(0,0,0,0.08)'
            : '0 8px 32px rgba(0,0,0,0.08)',
          transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        }}
      >
        {/* ── Imagem ────────────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden"
          style={{
            aspectRatio: '4/3',
            background: 'linear-gradient(135deg, var(--card-placeholder-from, #f3f4f6) 0%, var(--card-placeholder-to, #e5e7eb) 100%)',
          }}
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
            <div className="absolute inset-0 flex items-center justify-center">
              <TirePlaceholder />
            </div>
          )}

          {/* Brand pill badge — top right */}
          {produto.marca && (
            <span
              className="absolute top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                background: 'rgba(255,255,255,0.80)',
                color: 'var(--card-brand)',
                border: '1px solid rgba(255,255,255,0.60)',
              }}
            >
              {produto.marca}
            </span>
          )}

          {/* Discount badge — bottom left */}
          {disc && disc >= 5 && (
            <span
              className="absolute bottom-2 left-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                background: 'rgba(212,43,43,0.90)',
                color: '#fff',
              }}
            >
              -{disc}%
            </span>
          )}

          {/* Esgotado overlay */}
          {esgotado && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.50)' }}
            >
              <span
                className="text-xs text-white font-bold uppercase tracking-widest rounded-full px-4 py-1.5"
                style={{ background: 'rgba(0,0,0,0.60)' }}
              >
                Esgotado
              </span>
            </div>
          )}
        </div>

        {/* ── Conteúdo ──────────────────────────────────────── */}
        <div className="flex flex-col flex-1 p-2.5 sm:p-3.5">
          {/* Nome */}
          <p
            className="text-[11px] sm:text-[12.5px] font-medium leading-[1.35] mb-1.5 line-clamp-2 flex-1"
            style={{ color: 'var(--card-text)' }}
          >
            {produto.nome}
          </p>

          {/* Preço */}
          <div className="mt-auto">
            {precoPromo && (
              <span
                className="block text-[10px] line-through leading-none mb-0.5"
                style={{ color: 'var(--card-old-price, var(--dim))' }}
              >
                {formatPrice(preco)}
              </span>
            )}
            <span
              className="block font-black text-[15px] sm:text-[20px] leading-none tracking-tight"
              style={{ color: 'var(--vermelho)' }}
            >
              {produto.ehPai && (
                <span className="block text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--card-installment)' }}>
                  a partir de
                </span>
              )}
              {formatPrice(precoFinal)}
            </span>
            <span
              className="text-[9px] sm:text-[10px] mt-0.5 block"
              style={{ color: 'var(--card-installment)' }}
            >
              ou {formatPrice(precoFinal / 12)}/mês
            </span>
          </div>

          {/* CTA — pai de variações não tem compra rápida: precisa escolher tamanho */}
          {!esgotado && (
            <button
              onClick={produto.ehPai ? undefined : handleAddToCart}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-[12px] font-bold uppercase tracking-[0.4px] transition-all duration-300"
              style={{
                background: hov ? 'var(--vermelho)' : 'rgba(212,43,43,0.08)',
                color: hov ? '#fff' : 'var(--vermelho)',
                border: '1.5px solid rgba(212,43,43,0.30)',
                transform: hov ? 'scale(1)' : 'scale(0.97)',
                opacity: hov ? 1 : 0.85,
              }}
            >
              {produto.ehPai ? (
                <>Escolher tamanho</>
              ) : (
                <>
                  <ShoppingCart size={12} strokeWidth={2.5} />
                  Carrinho
                </>
              )}
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
