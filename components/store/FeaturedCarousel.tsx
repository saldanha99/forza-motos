'use client'

import { useRef } from 'react'
import { ProductCard } from './ProductCard'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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

export function FeaturedCarousel({ produtos }: { produtos: Produto[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => {
    ref.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 md:px-12 py-11">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-barlow font-bold text-[26px] text-[#111] tracking-[-0.3px]">
          Produtos em Destaque
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll(-1)}
            className="bg-white border border-[#e0e0e0] rounded-full w-[34px] h-[34px] flex items-center justify-center text-[#444] hover:border-[#d42b2b] hover:text-[#d42b2b] transition-all shadow-sm"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="bg-white border border-[#e0e0e0] rounded-full w-[34px] h-[34px] flex items-center justify-center text-[#444] hover:border-[#d42b2b] hover:text-[#d42b2b] transition-all shadow-sm"
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
          <Link
            href="/produtos"
            className="text-[#d42b2b] text-[13px] font-inter font-medium flex items-center gap-1 ml-1"
          >
            Ver todos <ChevronRight size={13} strokeWidth={2.5} />
          </Link>
        </div>
      </div>

      {/* Scroll container */}
      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto scrollbar-none pb-1"
      >
        {produtos.map((p) => (
          <div key={p.id} className="flex-shrink-0 w-[220px]">
            <ProductCard produto={p} />
          </div>
        ))}
      </div>
    </div>
  )
}
