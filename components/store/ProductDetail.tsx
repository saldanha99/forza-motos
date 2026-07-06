'use client'

import Image from 'next/image'
import { useState, useRef, useCallback, useEffect } from 'react'
import { ShoppingCart, MessageCircle, ChevronLeft, ChevronRight, ZoomIn, X } from 'lucide-react'
import { formatPrice, whatsappLink } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { ProductReviews } from './ProductReviews'
import { CalculadorFrete } from './CalculadorFrete'

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

// ── Placeholder SVG (sem imagem) ──────────────────────────────────────────────
function PlaceholderImg() {
  return (
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
  )
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ imagens, idx, onClose, onPrev, onNext }: {
  imagens: string[]
  idx: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  // Fechar com ESC
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onPrev()
      if (e.key === 'ArrowRight') onNext()
    }
    window.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', fn); document.body.style.overflow = '' }
  }, [onClose, onPrev, onNext])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      {/* Imagem */}
      <div
        className="relative"
        style={{ width: 'min(90vw, 720px)', aspectRatio: '1' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={imagens[idx]}
          alt=""
          fill
          className="object-contain"
          sizes="720px"
          priority
        />
      </div>

      {/* Fechar */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
        style={{ background: 'rgba(255,255,255,0.12)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)' }}
      >
        <X size={18} className="text-white" />
      </button>

      {/* Prev */}
      {imagens.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)' }}
        >
          <ChevronLeft size={20} className="text-white" />
        </button>
      )}

      {/* Next */}
      {imagens.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.12)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.25)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)' }}
        >
          <ChevronRight size={20} className="text-white" />
        </button>
      )}

      {/* Dots */}
      {imagens.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5">
          {imagens.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); /* handled via idx prop */ }}
              className="w-2 h-2 rounded-full transition-all"
              style={{ background: i === idx ? '#fff' : 'rgba(255,255,255,0.35)' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Galeria principal ─────────────────────────────────────────────────────────
function Galeria({ imagens, disc }: { imagens: string[]; disc: number | null }) {
  const [imgIdx,     setImgIdx]     = useState(0)
  const [lightbox,   setLightbox]   = useState(false)
  const [transitioning, setTransitioning] = useState(false)

  // Touch/swipe
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  function changeIdx(next: number) {
    if (imagens.length <= 1) return
    setTransitioning(true)
    setTimeout(() => {
      setImgIdx(next)
      setTransitioning(false)
    }, 120)
  }

  const prev = useCallback(() => changeIdx((imgIdx - 1 + imagens.length) % imagens.length), [imgIdx, imagens.length])
  const next = useCallback(() => changeIdx((imgIdx + 1) % imagens.length), [imgIdx, imagens.length])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = Math.abs(e.changedTouches[0].clientY - (touchStartY.current ?? 0))
    // Só aciona se swipe horizontal (dx > 40px, dy < 80px)
    if (Math.abs(dx) > 40 && dy < 80) {
      if (dx < 0) next(); else prev()
    }
    touchStartX.current = null
  }

  return (
    <>
      {/* Main image */}
      <div
        className="relative overflow-hidden mb-3 cursor-zoom-in group"
        style={{
          background: 'radial-gradient(circle at 55% 45%, #fff 0%, #f4f4f4 100%)',
          borderRadius: 8,
          border: '1.5px solid #eee',
          aspectRatio: '1',
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onClick={() => imagens.length > 0 && setLightbox(true)}
      >
        {imagens[imgIdx] ? (
          <>
            <Image
              src={imagens[imgIdx]}
              alt=""
              fill
              className="object-contain p-6 transition-opacity duration-150"
              style={{ opacity: transitioning ? 0 : 1 }}
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {/* Hover zoom hint */}
            <div
              className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
              style={{ background: 'rgba(0,0,0,0.45)' }}
            >
              <ZoomIn size={14} className="text-white" />
            </div>
          </>
        ) : (
          <PlaceholderImg />
        )}

        {/* Badge desconto */}
        {disc && (
          <span
            className="absolute top-3 left-3 text-white text-[11px] font-barlow font-bold px-2 py-[3px] z-10"
            style={{ background: '#d42b2b', borderRadius: 2 }}
          >
            -{disc}%
          </span>
        )}

        {/* Setas */}
        {imagens.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border border-[#eee] p-1.5 rounded-full transition-all shadow-sm opacity-0 group-hover:opacity-100"
            >
              <ChevronLeft size={18} className="text-[#444]" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white border border-[#eee] p-1.5 rounded-full transition-all shadow-sm opacity-0 group-hover:opacity-100"
            >
              <ChevronRight size={18} className="text-[#444]" />
            </button>
          </>
        )}

        {/* Dots (mobile) */}
        {imagens.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 sm:hidden">
            {imagens.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); setImgIdx(i) }}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i === imgIdx ? '#d42b2b' : 'rgba(0,0,0,0.20)' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {imagens.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {imagens.map((img, i) => (
            <button
              key={i}
              onClick={() => changeIdx(i)}
              className="relative w-16 h-16 overflow-hidden transition-all hover:scale-105"
              style={{
                borderRadius: 6,
                border: `2px solid ${i === imgIdx ? '#d42b2b' : '#eee'}`,
                background: '#f9f9f9',
                outline: i === imgIdx ? '2px solid rgba(212,43,43,0.20)' : 'none',
                outlineOffset: 2,
              }}
            >
              <Image src={img} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          imagens={imagens}
          idx={imgIdx}
          onClose={() => setLightbox(false)}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export function ProductDetail({
  produto,
  seletorTamanho,
}: {
  produto: Produto
  /** Seletor de tamanho renderizado pelo server (variações da mesma família) */
  seletorTamanho?: React.ReactNode
}) {
  const imagens = Array.isArray(produto.imagens) ? produto.imagens : []
  const adicionarItem = useCartStore((s) => s.adicionarItem)

  const preco = Number(produto.preco)
  const precoPromo = produto.precoPromocional ? Number(produto.precoPromocional) : null
  const disc = precoPromo ? Math.round((1 - precoPromo / preco) * 100) : null

  const compatibilidade = Array.isArray(produto.compatibilidadeMotos)
    ? produto.compatibilidadeMotos
    : []

  function handleAddToCart() {
    adicionarItem({
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      preco: precoPromo ?? preco,
      imagem: imagens[0],
    })
  }

  const whatsLink = whatsappLink(
    '5519974049445',
    `Olá! Tenho interesse no produto: ${produto.nome}`
  )

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* ── Galeria ── */}
        <div>
          <Galeria imagens={imagens} disc={disc} />
        </div>

        {/* ── Info ── */}
        <div>
          {/* Marca / categoria */}
          <p className="text-[11px] font-inter text-[#aaa] uppercase tracking-[0.5px] mb-2">
            {produto.marca} · {produto.categoria}
          </p>

          {/* Nome */}
          <h1 className="font-barlow font-black text-[28px] md:text-[38px] text-[#111] leading-[1.05] mb-5 tracking-[-0.5px]">
            {produto.nome}
          </h1>

          {/* Seletor de tamanho (variações da família) */}
          {seletorTamanho}

          {/* Preço */}
          <div className="mb-6">
            {precoPromo ? (
              <>
                <div className="font-inter text-[13px] text-[#bbb] line-through mb-1">
                  {formatPrice(preco)}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="font-barlow font-black text-[44px] leading-none tracking-[-1px]" style={{ color: '#d42b2b' }}>
                    {formatPrice(precoPromo)}
                  </span>
                  <span className="font-barlow font-bold text-[14px] text-white px-2.5 py-1" style={{ background: '#d42b2b', borderRadius: 3 }}>
                    -{disc}%
                  </span>
                </div>
                <p className="font-inter text-[12px] text-[#888] mt-1">ou em 12x sem juros no cartão</p>
              </>
            ) : (
              <>
                <div className="font-barlow font-black text-[44px] leading-none tracking-[-1px] text-[#111]">
                  {formatPrice(preco)}
                </div>
                <p className="font-inter text-[12px] text-[#888] mt-1">ou em 12x sem juros no cartão</p>
              </>
            )}
          </div>

          {/* Estoque */}
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

          {/* Calcular frete */}
          <div className="mb-6">
            <CalculadorFrete subtotal={precoPromo ?? preco} compact />
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <button
              onClick={handleAddToCart}
              disabled={produto.estoque === 0}
              className="flex-1 flex items-center justify-center gap-2 font-barlow font-bold text-[17px] uppercase tracking-[0.5px] text-white py-[14px] px-6 transition-colors disabled:opacity-40 active:scale-[0.98]"
              style={{ background: '#d42b2b', borderRadius: 3 }}
              onMouseEnter={(e) => { if (produto.estoque > 0) (e.currentTarget as HTMLButtonElement).style.background = '#b82222' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#d42b2b' }}
            >
              <ShoppingCart size={18} />
              COMPRAR AGORA
            </button>

            <a href={whatsLink} target="_blank" rel="noopener noreferrer" className="flex-1">
              <button
                className="w-full flex items-center justify-center gap-2 font-barlow font-bold text-[17px] uppercase tracking-[0.5px] py-[14px] px-6 transition-colors text-[#25d366] active:scale-[0.98]"
                style={{ border: '1.5px solid #25d366', borderRadius: 3, background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#25d366'; (e.currentTarget as HTMLButtonElement).style.color = '#fff' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#25d366' }}
              >
                <MessageCircle size={18} />
                WHATSAPP
              </button>
            </a>
          </div>

          {/* Descrição */}
          <div className="border-t border-[#eee] pt-6">
            <h3 className="font-barlow font-bold text-[16px] text-[#111] mb-3 uppercase tracking-[0.3px]">Descrição</h3>
            <div
              className="font-inter text-[14px] text-[#555] leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: (produto.descricao ?? '')
                  .replace(/\n/g, '<br />')
                  .replace(/(<br\s*\/?>){3,}/gi, '<br /><br />'),
              }}
            />
          </div>

          {/* Compatibilidade */}
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

      {/* ── Avaliações ── */}
      <ProductReviews productId={produto.id} />
    </>
  )
}
