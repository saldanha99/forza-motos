'use client'

import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import Image from 'next/image'
import Link from 'next/link'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'

export default function CarrinhoPage() {
  const { items, removerItem, atualizarQuantidade, subtotal } = useCartStore()

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShoppingBag size={36} className="text-faint" />
        </div>
        <h1 className="font-grotesk font-bold text-3xl text-ink mb-3">Carrinho vazio</h1>
        <p className="text-dim mb-8">Adicione produtos para continuar comprando.</p>
        <Link href="/produtos">
          <Button size="lg">Ver Produtos</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-grotesk font-bold text-3xl text-ink mb-8">
        Carrinho
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Itens */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-card border border-line rounded-xl p-4 flex gap-4">
              <div className="relative w-20 h-20 bg-surface rounded-lg overflow-hidden shrink-0">
                {item.imagem ? (
                  <Image src={item.imagem} alt={item.nome} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🛞</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-ink line-clamp-2">{item.nome}</h3>
                <p className="text-vermelho font-bold mt-1">{formatPrice(item.preco)}</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1 bg-surface border border-line rounded-md">
                    <button
                      onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                      className="p-1.5 text-dim hover:text-ink transition-colors"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="text-ink text-sm w-6 text-center font-medium">{item.quantidade}</span>
                    <button
                      onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                      className="p-1.5 text-dim hover:text-ink transition-colors"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  <button
                    onClick={() => removerItem(item.id)}
                    className="text-faint hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <p className="font-bold text-ink text-sm shrink-0">
                {formatPrice(item.preco * item.quantidade)}
              </p>
            </div>
          ))}
        </div>

        {/* Resumo */}
        <div>
          <div className="bg-card border border-line rounded-xl p-6 sticky top-24">
            <h2 className="font-grotesk font-semibold text-lg text-ink mb-4">Resumo</h2>
            <div className="space-y-3 text-sm text-dim mb-6">
              <div className="flex justify-between">
                <span>Subtotal ({items.reduce((a, i) => a + i.quantidade, 0)} itens)</span>
                <span className="text-ink font-medium">{formatPrice(subtotal())}</span>
              </div>
              <div className="flex justify-between">
                <span>Frete</span>
                <span className="text-faint text-xs">calculado no checkout</span>
              </div>
              <div className="border-t border-line pt-3 flex justify-between text-ink font-bold text-base">
                <span>Total estimado</span>
                <span>{formatPrice(subtotal())}</span>
              </div>
            </div>
            <Link href="/checkout">
              <Button size="lg" className="w-full">Ir para Checkout</Button>
            </Link>
            <Link href="/produtos">
              <Button variant="ghost" size="sm" className="w-full mt-2">Continuar comprando</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
