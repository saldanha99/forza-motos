'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ShoppingCart, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPrice, whatsappLink } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import toast from 'react-hot-toast'

interface Produto {
  id: string
  nome: string
  slug: string
  descricao: string
  preco: any
  precoPromocional?: any
  imagens: any
  estoque: number
  marca: string
  categoria: string
  compatibilidadeMotos: any
}

export function ProductDetail({ produto }: { produto: Produto }) {
  const imagens = Array.isArray(produto.imagens) ? produto.imagens : []
  const [imgIdx, setImgIdx] = useState(0)
  const adicionarItem = useCartStore((s) => s.adicionarItem)

  const compatibilidade = Array.isArray(produto.compatibilidadeMotos)
    ? produto.compatibilidadeMotos
    : []

  const preco = Number(produto.preco)
  const precoPromo = produto.precoPromocional ? Number(produto.precoPromocional) : null
  const disc = precoPromo ? Math.round((1 - precoPromo / preco) * 100) : null

  function handleAddToCart() {
    adicionarItem({
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      preco: precoPromo ?? preco,
      imagem: imagens[0],
    })
    toast.success('Adicionado ao carrinho!')
  }

  const whatsLink = whatsappLink(
    '5519974049445',
    `Olá! Tenho interesse no produto: ${produto.nome}`
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

      {/* ── Galeria ── */}
      <div>
        {/* Main image */}
        <div
          className="relative overflow-hidden mb-3"
          style={{
            background: 'radial-gradient(circle at 55% 45%, #fff 0%, #f4f4f4 100%)',
            borderRadius: 6,
            border: '1.5px solid #eee',
            aspectRatio: '1',
          }}
        >
          {imagens[imgIdx] ? (
            <Image
              src={imagens[imgIdx]}
              alt={produto.nome}
              fill
              className="object-contain p-6"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg viewBox="0 0 120 120" fill="none" width="110" height="110">
                <circle cx="60" cy="60" r="50" stroke="#ddd" strokeWidth="11"/>
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = (i / 8) * Math.PI * 2
                  return <line key={i} x1={60 + 32 * Math.cos(a)} y1={60 + 32 * Math.sin(a)} x2={60 + 40 * Math.cos(a)} y2={60 + 40 * Math.sin(a)} stroke="#ccc" strokeWidth="4.5" strokeLinecap="round"/>
                })}
                <circle cx="60" cy="60" r="28" stroke="#e0e0e0" strokeWidth="8"/>
                <circle cx="60" cy="60" r="18" fill="#f0f0f0" stroke="#e0e0e0" strokeWidth="2"/>
                <circle cx="60" cy="60" r="8" fill="#d42b2b" opacity="0.55"/>
              </svg>
            </div>
          )}

          {disc && (
            <span
              className="absolute top-3 left-3 text-white text-[11px] font-barlow font-bold px-2 py-[3px]"
              style={{ background: '#d42b2b', borderRadius: 2 }}
            >
              -{disc}%
            </span>
          )}

          {imagens.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx((i) => (i - 1 + imagens.length) % imagens.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border border-[#eee] p-1.5 rounded-full transition-colors shadow-sm"
              >
                <ChevronLeft size={18} className="text-[#444]" />
              </button>
              <button
                onClick={() => setImgIdx((i) => (i + 1) % imagens.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border border-[#eee] p-1.5 rounded-full transition-colors shadow-sm"
              >
                <ChevronRight size={18} className="text-[#444]" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {imagens.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {imagens.map((img: string, i: number) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className="relative w-16 h-16 overflow-hidden transition-all"
                style={{
                  borderRadius: 4,
                  border: `1.5px solid ${i === imgIdx ? '#d42b2b' : '#eee'}`,
                  background: '#f9f9f9',
                }}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <div>
        {/* Brand / category breadcrumb */}
        <p className="text-[11px] font-inter text-[#aaa] uppercase tracking-[0.5px] mb-2">
          {produto.marca} · {produto.categoria}
        </p>

        {/* Product name */}
        <h1 className="font-barlow font-black text-[34px] md:text-[40px] text-[#111] leading-[1.05] mb-5 tracking-[-0.5px]">
          {produto.nome}
        </h1>

        {/* Price */}
        <div className="mb-6">
          {precoPromo ? (
            <>
              <div className="font-inter text-[13px] text-[#bbb] line-through mb-1">
                {formatPrice(preco)}
              </div>
              <div className="flex items-baseline gap-3">
                <span className="font-barlow font-black text-[48px] leading-none tracking-[-1px]" style={{ color: '#d42b2b' }}>
                  {formatPrice(precoPromo)}
                </span>
                <span
                  className="font-barlow font-bold text-[15px] text-white px-2.5 py-1"
                  style={{ background: '#d42b2b', borderRadius: 3 }}
                >
                  -{disc}%
                </span>
              </div>
              <p className="font-inter text-[12px] text-[#888] mt-1">ou em 12x sem juros no cartão</p>
            </>
          ) : (
            <>
              <div className="font-barlow font-black text-[48px] leading-none tracking-[-1px] text-[#111]">
                {formatPrice(preco)}
              </div>
              <p className="font-inter text-[12px] text-[#888] mt-1">ou em 12x sem juros no cartão</p>
            </>
          )}
        </div>

        {/* Stock indicator */}
        {produto.estoque > 0 ? (
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="text-[13px] font-inter text-green-700">Em estoque</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            <span className="text-[13px] font-inter text-red-600">Fora de estoque</span>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={handleAddToCart}
            disabled={produto.estoque === 0}
            className="flex-1 flex items-center justify-center gap-2 font-barlow font-bold text-[17px] uppercase tracking-[0.5px] text-white py-[14px] px-6 transition-colors disabled:opacity-40"
            style={{ background: '#d42b2b', borderRadius: 3 }}
            onMouseEnter={(e) => { if (produto.estoque > 0) (e.currentTarget as HTMLButtonElement).style.background = '#b82222' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#d42b2b' }}
          >
            <ShoppingCart size={18} />
            COMPRAR AGORA
          </button>

          <a href={whatsLink} target="_blank" rel="noopener noreferrer" className="flex-1">
            <button
              className="w-full flex items-center justify-center gap-2 font-barlow font-bold text-[17px] uppercase tracking-[0.5px] py-[14px] px-6 transition-colors text-[#25d366]"
              style={{ border: '1.5px solid #25d366', borderRadius: 3, background: 'transparent' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#25d366'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#25d366' }}
            >
              <MessageCircle size={18} />
              WHATSAPP
            </button>
          </a>
        </div>

        {/* Description */}
        <div className="border-t border-[#eee] pt-6">
          <h3 className="font-barlow font-bold text-[16px] text-[#111] mb-3 uppercase tracking-[0.3px]">Descrição</h3>
          <div
            className="font-inter text-[14px] text-[#555] leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{
              __html: (produto.descricao ?? '')
                // Normaliza quebras de linha em <br>
                .replace(/\n/g, '<br />')
                // Remove <br /> duplicados seguidos
                .replace(/(<br\s*\/?>){3,}/gi, '<br /><br />'),
            }}
          />
        </div>

        {/* Compatibility */}
        {compatibilidade.length > 0 && (
          <div className="mt-6 border-t border-[#eee] pt-6">
            <h3 className="font-barlow font-bold text-[16px] text-[#111] mb-3 uppercase tracking-[0.3px]">Compatibilidade</h3>
            <div className="flex flex-wrap gap-2">
              {compatibilidade.map((moto: string) => (
                <span
                  key={moto}
                  className="font-inter text-[12px] text-[#555] px-3 py-1"
                  style={{ background: '#f5f5f5', border: '1px solid #eee', borderRadius: 4 }}
                >
                  {moto}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
