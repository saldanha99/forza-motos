'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  const imagens = Array.isArray(produto.imagens) ? produto.imagens : []
  const imagem = imagens[0] || null

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault()
    adicionarItem({
      id: produto.id,
      nome: produto.nome,
      slug: produto.slug,
      preco: Number(produto.precoPromocional ?? produto.preco),
      imagem: imagem,
    })
    toast.success('Adicionado ao carrinho!')
  }

  return (
    <Link href={`/produtos/${produto.slug}`}>
      <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-lg overflow-hidden transition-all duration-200 group">
        {/* Imagem */}
        <div className="relative aspect-square bg-zinc-800 overflow-hidden">
          {imagem ? (
            <Image
              src={imagem}
              alt={produto.nome}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-4xl">
              🛞
            </div>
          )}
          {produto.precoPromocional && (
            <span className="absolute top-2 left-2 bg-vermelho text-white text-xs font-bold px-2 py-0.5 rounded">
              PROMO
            </span>
          )}
          {produto.estoque === 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-xs text-zinc-400 font-semibold">ESGOTADO</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <p className="text-xs text-zinc-500 mb-1">{produto.marca}</p>
          <h3 className="text-sm font-medium text-white line-clamp-2 mb-2 leading-tight">
            {produto.nome}
          </h3>
          <div className="flex items-center justify-between gap-2">
            <div>
              {produto.precoPromocional ? (
                <>
                  <p className="text-xs text-zinc-600 line-through">
                    {formatPrice(produto.preco)}
                  </p>
                  <p className="text-base font-bold text-vermelho">
                    {formatPrice(produto.precoPromocional)}
                  </p>
                </>
              ) : (
                <p className="text-base font-bold text-white">
                  {formatPrice(produto.preco)}
                </p>
              )}
            </div>
            {produto.estoque > 0 && (
              <button
                onClick={handleAddToCart}
                className="p-2 bg-vermelho hover:bg-red-700 text-white rounded transition-colors"
                aria-label="Adicionar ao carrinho"
              >
                <ShoppingCart size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
