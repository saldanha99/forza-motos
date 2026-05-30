'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import { ShoppingBag, Gift, Truck, Tag, ArrowRight, Star } from 'lucide-react'

interface ProdutoAnuncio {
  id: string
  nome: string
  slug: string
  preco: number
  precoPromocional: number | null
  imagem: string | null
  marca: string
}

/**
 * Sidebar de anúncios do e-commerce na página do glossário.
 * Banners, produtos em destaque e CTA de frete grátis — tudo sticky.
 */
export function GlossarioSidebar({ produtos }: { produtos: ProdutoAnuncio[] }) {
  return (
    <aside className="space-y-5 lg:sticky lg:top-24">

      {/* Banner principal — frete grátis */}
      <Link href="/produtos" className="block group">
        <div className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: 'linear-gradient(135deg,#d42b2b,#8a1818)' }}>
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20" style={{ background: '#fff' }} />
          <Gift size={22} className="mb-2" />
          <p className="font-barlow font-black text-lg leading-tight">FRETE GRÁTIS</p>
          <p className="text-xs opacity-90 mt-1">Acima de R$499 para todo o estado de SP</p>
          <span className="inline-flex items-center gap-1 text-xs font-bold mt-3 group-hover:gap-2 transition-all">
            Ver produtos <ArrowRight size={13} />
          </span>
        </div>
      </Link>

      {/* Produtos em destaque (anúncios) */}
      {produtos.length > 0 && (
        <div className="rounded-2xl border border-[#eee] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#eee]" style={{ background: '#fafafa' }}>
            <Tag size={14} className="text-[#d42b2b]" />
            <span className="font-barlow font-bold text-sm text-[#111] uppercase tracking-wide">Ofertas da loja</span>
          </div>
          <div className="divide-y divide-[#f2f2f2]">
            {produtos.map((p) => {
              const promo = p.precoPromocional
              const disc = promo ? Math.round((1 - promo / p.preco) * 100) : null
              return (
                <Link key={p.id} href={`/produtos/${p.slug}`} className="flex gap-3 p-3 hover:bg-[#fafafa] transition-colors group">
                  <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-[#eee]" style={{ background: '#f9f9f9' }}>
                    {p.imagem
                      ? <Image src={p.imagem} alt={p.nome} fill className="object-contain p-1" />
                      : <div className="w-full h-full flex items-center justify-center"><ShoppingBag size={20} className="text-[#ccc]" /></div>}
                    {disc && (
                      <span className="absolute top-0.5 left-0.5 text-[8px] font-bold text-white px-1 rounded" style={{ background: '#d42b2b' }}>-{disc}%</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-[#aaa] uppercase tracking-wide">{p.marca}</p>
                    <p className="text-xs font-medium text-[#222] line-clamp-2 leading-tight group-hover:text-[#d42b2b] transition-colors">{p.nome}</p>
                    <p className="text-sm font-barlow font-black mt-1" style={{ color: promo ? '#d42b2b' : '#111' }}>
                      {formatPrice(promo ?? p.preco)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
          <Link href="/produtos" className="block text-center py-2.5 text-xs font-bold text-[#d42b2b] border-t border-[#eee] hover:bg-[#fafafa] transition-colors">
            Ver todos os produtos →
          </Link>
        </div>
      )}

      {/* Banner secundário — instalação */}
      <Link href="/servicos" className="block group">
        <div className="rounded-2xl border-2 border-dashed border-[#d42b2b]/30 p-4 text-center hover:border-[#d42b2b]/60 transition-colors" style={{ background: 'rgba(212,43,43,0.03)' }}>
          <Truck size={20} className="mx-auto mb-2 text-[#d42b2b]" />
          <p className="font-barlow font-bold text-sm text-[#111]">Instalação no local</p>
          <p className="text-[11px] text-[#888] mt-0.5">Box rápido · 30 min</p>
        </div>
      </Link>

      {/* Selo de confiança */}
      <div className="rounded-2xl border border-[#eee] p-4 flex items-center gap-3" style={{ background: '#fafafa' }}>
        <div className="flex">
          {[1,2,3,4,5].map((i) => <Star key={i} size={13} fill="#f59e0b" stroke="#f59e0b" />)}
        </div>
        <div>
          <p className="text-xs font-bold text-[#111]">4.9 no Google</p>
          <p className="text-[10px] text-[#888]">+5.000 motos atendidas</p>
        </div>
      </div>
    </aside>
  )
}
