'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
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

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    adicionarItem({
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      preco: precoPromo ?? preco,
      imagem,
    })
    toast.success('Adicionado ao carrinho!')
  }

  return (
    <Link href={`/produtos/${produto.slug}`}>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        className="bg-white overflow-hidden transition-all duration-[180ms] cursor-pointer"
        style={{
          borderRadius: '6px',
          border: `1.5px solid ${hov ? '#d42b2b' : '#eee'}`,
          boxShadow: hov ? '0 4px 18px rgba(212,43,43,0.12)' : '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        {/* Image */}
        <div className="relative w-full" style={{ paddingBottom: '85%', background: 'radial-gradient(circle at 55% 45%, #fff 0%, #f4f4f4 100%)' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            {imagem ? (
              <Image
                src={imagem}
                alt={produto.nome}
                fill
                className="object-cover"
                style={{ transition: 'transform 0.3s', transform: hov ? 'scale(1.05)' : 'scale(1)' }}
              />
            ) : (
              <svg viewBox="0 0 120 120" fill="none" width="90" height="90">
                <circle cx="60" cy="60" r="50" stroke="#ddd" strokeWidth="11"/>
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = (i / 8) * Math.PI * 2
                  return <line key={i} x1={60 + 32 * Math.cos(a)} y1={60 + 32 * Math.sin(a)} x2={60 + 40 * Math.cos(a)} y2={60 + 40 * Math.sin(a)} stroke="#ccc" strokeWidth="4.5" strokeLinecap="round"/>
                })}
                <circle cx="60" cy="60" r="28" stroke="#e0e0e0" strokeWidth="8"/>
                <circle cx="60" cy="60" r="18" fill="#f0f0f0" stroke="#e0e0e0" strokeWidth="2"/>
                <circle cx="60" cy="60" r="8" fill="#d42b2b" opacity="0.55"/>
              </svg>
            )}
          </div>
          {disc && (
            <span
              className="absolute top-2.5 left-2.5 text-white text-[11px] font-barlow font-bold px-2 py-[3px]"
              style={{ background: '#d42b2b', borderRadius: '2px' }}
            >
              -{disc}%
            </span>
          )}
          {produto.estoque === 0 && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-xs text-white font-semibold bg-black/70 px-2 py-1 rounded">ESGOTADO</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="px-[14px] pb-[16px] pt-3">
          <div className="text-[10px] text-[#aaa] font-inter mb-1 tracking-[0.3px]">{produto.marca}</div>
          <div className="text-[13.5px] font-inter font-medium text-[#222] leading-[1.4] mb-2.5 min-h-[38px] line-clamp-2">
            {produto.nome}
          </div>
          {precoPromo && (
            <div className="text-[12px] font-inter text-[#bbb] line-through mb-0.5">
              {formatPrice(preco)}
            </div>
          )}
          <div
            className="font-barlow font-bold text-[22px] leading-none tracking-[-0.3px]"
            style={{ color: '#d42b2b' }}
          >
            {formatPrice(precoPromo ?? preco)}
          </div>
          {/* Badge de estoque */}
          <div className="mt-1.5 mb-1">
            {produto.estoque >= 999 ? (
              <span className="text-[10px] font-inter font-medium text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Disponível
              </span>
            ) : produto.estoque > 0 ? (
              <span className="text-[10px] font-inter font-medium text-orange-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                {produto.estoque} em estoque
              </span>
            ) : null}
          </div>
          {produto.estoque > 0 && (
            <button
              onClick={handleAddToCart}
              className="w-full mt-2.5 py-2 font-barlow font-bold text-[14px] tracking-[0.3px] uppercase transition-all duration-[180ms]"
              style={{
                border: '1.5px solid #d42b2b',
                borderRadius: '3px',
                background: hov ? '#d42b2b' : '#fff',
                color: hov ? '#fff' : '#d42b2b',
              }}
            >
              Adicionar ao Carrinho
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}
