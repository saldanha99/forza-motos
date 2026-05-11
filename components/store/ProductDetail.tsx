'use client'

import Image from 'next/image'
import { useState } from 'react'
import { ShoppingCart, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatPrice, whatsappLink } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { Button } from '@/components/ui/Button'
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

  function handleAddToCart() {
    adicionarItem({
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      preco: Number(produto.precoPromocional ?? produto.preco),
      imagem: imagens[0],
    })
    toast.success('Adicionado ao carrinho!')
  }

  const whatsLink = whatsappLink(
    '5519974049445',
    `Olá! Tenho interesse no produto: ${produto.nome}`
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
      {/* Galeria */}
      <div>
        <div className="relative aspect-square bg-zinc-900 rounded-lg overflow-hidden mb-3">
          {imagens[imgIdx] ? (
            <Image
              src={imagens[imgIdx]}
              alt={produto.nome}
              fill
              className="object-contain p-4"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-7xl">🛞</div>
          )}
          {imagens.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx((i) => (i - 1 + imagens.length) % imagens.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-1.5 rounded-full text-white"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setImgIdx((i) => (i + 1) % imagens.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-1.5 rounded-full text-white"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>
        {imagens.length > 1 && (
          <div className="flex gap-2">
            {imagens.map((img: string, i: number) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                className={`relative w-16 h-16 rounded border-2 overflow-hidden transition-colors ${
                  i === imgIdx ? 'border-vermelho' : 'border-zinc-700'
                }`}
              >
                <Image src={img} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{produto.marca} · {produto.categoria}</p>
        <h1 className="font-rajdhani font-bold text-3xl text-white mb-4">{produto.nome}</h1>

        <div className="mb-6">
          {produto.precoPromocional ? (
            <>
              <p className="text-zinc-500 line-through text-sm">{formatPrice(produto.preco)}</p>
              <p className="text-4xl font-bold text-vermelho">{formatPrice(produto.precoPromocional)}</p>
            </>
          ) : (
            <p className="text-4xl font-bold text-white">{formatPrice(produto.preco)}</p>
          )}
        </div>

        {produto.estoque > 0 ? (
          <p className="text-sm text-green-400 mb-6">✓ Em estoque ({produto.estoque} unidade{produto.estoque !== 1 ? 's' : ''})</p>
        ) : (
          <p className="text-sm text-red-400 mb-6">✗ Fora de estoque</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <Button
            size="lg"
            onClick={handleAddToCart}
            disabled={produto.estoque === 0}
            className="flex-1"
          >
            <ShoppingCart size={18} />
            Comprar
          </Button>
          <a href={whatsLink} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button variant="outline" size="lg" className="w-full border-green-600 text-green-400 hover:bg-green-600 hover:text-white">
              <MessageCircle size={18} />
              Orçar no WhatsApp
            </Button>
          </a>
        </div>

        <div className="prose prose-invert prose-sm max-w-none">
          <h3 className="font-rajdhani font-semibold text-white mb-2">Descrição</h3>
          <p className="text-zinc-400 whitespace-pre-line text-sm leading-relaxed">{produto.descricao}</p>
        </div>

        {compatibilidade.length > 0 && (
          <div className="mt-6">
            <h3 className="font-rajdhani font-semibold text-white mb-3">Compatibilidade</h3>
            <div className="flex flex-wrap gap-2">
              {compatibilidade.map((moto: string) => (
                <span key={moto} className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">
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
