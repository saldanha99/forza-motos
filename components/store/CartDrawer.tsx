'use client'

/**
 * Mini-carrinho lateral (drawer): abre ao adicionar item e acompanha o
 * cliente até o checkout. No mobile, um pill flutuante mantém o carrinho
 * sempre à vista enquanto houver itens.
 */
import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/lib/utils'
import { X, Minus, Plus, ShoppingCart, Trash2, ArrowRight, Truck } from 'lucide-react'

const FRETE_GRATIS_SP = 499

export function CartDrawer() {
  const pathname = usePathname()
  const {
    items, drawerAberto, fecharDrawer, abrirDrawer,
    atualizarQuantidade, removerItem, subtotal, _hasHydrated,
  } = useCartStore()

  const total = subtotal()
  const qtd = items.reduce((acc, i) => acc + i.quantidade, 0)

  // Trava o scroll do body com o drawer aberto + fecha no Esc
  useEffect(() => {
    if (!drawerAberto) return
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fecharDrawer()
    window.addEventListener('keydown', esc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', esc)
    }
  }, [drawerAberto, fecharDrawer])

  // Fecha ao navegar (ex.: clicou num produto dentro do drawer)
  useEffect(() => {
    fecharDrawer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Nas páginas de carrinho/checkout o resumo já está na tela
  if (!_hasHydrated || pathname.startsWith('/carrinho') || pathname.startsWith('/checkout')) {
    return null
  }

  const faltaFreteGratis = Math.max(0, FRETE_GRATIS_SP - total)
  const progresso = Math.min(100, (total / FRETE_GRATIS_SP) * 100)

  return (
    <>
      {/* ── Pill flutuante (mobile) — carrinho nunca some de vista ── */}
      {qtd > 0 && !drawerAberto && (
        <button
          onClick={abrirDrawer}
          className="lg:hidden fixed bottom-5 left-4 z-[60] flex items-center gap-2.5 rounded-full pl-3.5 pr-4 py-2.5 shadow-[0_8px_24px_rgba(212,43,43,0.45)] text-white font-barlow font-bold text-sm"
          style={{ background: '#d42b2b' }}
          aria-label="Abrir carrinho"
        >
          <span className="relative">
            <ShoppingCart size={18} />
            <span className="absolute -top-2 -right-2 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-white text-[#d42b2b] text-[10px] font-black">
              {qtd}
            </span>
          </span>
          {formatPrice(total)}
        </button>
      )}

      {/* ── Overlay ── */}
      <div
        onClick={fecharDrawer}
        className={`fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          drawerAberto ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* ── Drawer ── */}
      <aside
        className={`fixed top-0 right-0 z-[80] h-full w-full max-w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          drawerAberto ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!drawerAberto}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#eee]">
          <h2 className="font-barlow font-black text-xl text-[#111] flex items-center gap-2">
            <ShoppingCart size={20} className="text-[#d42b2b]" />
            Seu carrinho
            {qtd > 0 && <span className="text-sm font-bold text-[#999]">({qtd})</span>}
          </h2>
          <button
            onClick={fecharDrawer}
            aria-label="Fechar carrinho"
            className="p-2 rounded-full hover:bg-[#f5f5f5] text-[#666] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingCart size={44} className="text-[#ddd]" />
            <p className="font-barlow font-bold text-lg text-[#333]">Seu carrinho está vazio</p>
            <button
              onClick={fecharDrawer}
              className="text-sm font-semibold text-[#d42b2b] hover:underline"
            >
              Continuar comprando
            </button>
          </div>
        ) : (
          <>
            {/* Barra de frete grátis */}
            <div className="px-5 py-3 bg-[#fafafa] border-b border-[#eee]">
              {faltaFreteGratis > 0 ? (
                <p className="text-[12px] font-inter text-[#555] mb-1.5 flex items-center gap-1.5">
                  <Truck size={13} className="text-[#d42b2b]" />
                  Faltam <strong>{formatPrice(faltaFreteGratis)}</strong> para <strong>frete grátis</strong> (SP)
                </p>
              ) : (
                <p className="text-[12px] font-inter text-emerald-600 font-semibold mb-1.5 flex items-center gap-1.5">
                  <Truck size={13} /> Você ganhou frete grátis para SP! 🎉
                </p>
              )}
              <div className="h-1.5 rounded-full bg-[#e8e8e8] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progresso}%`, background: faltaFreteGratis > 0 ? '#d42b2b' : '#059669' }}
                />
              </div>
            </div>

            {/* Itens */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <Link
                    href={`/produtos/${item.slug}`}
                    className="relative w-16 h-16 rounded-lg border border-[#eee] bg-white shrink-0 overflow-hidden"
                  >
                    {item.imagem && (
                      <Image src={item.imagem} alt={item.nome} fill sizes="64px" className="object-contain p-1" />
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/produtos/${item.slug}`}
                      className="block font-inter text-[13px] font-semibold text-[#222] leading-snug line-clamp-2 hover:text-[#d42b2b] transition-colors"
                    >
                      {item.nome}
                    </Link>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-[#ddd] rounded-lg overflow-hidden">
                        <button
                          onClick={() => atualizarQuantidade(item.id, item.quantidade - 1)}
                          className="px-2 py-1 text-[#666] hover:bg-[#f5f5f5]"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="px-2.5 text-[13px] font-bold text-[#111] min-w-[28px] text-center">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => atualizarQuantidade(item.id, item.quantidade + 1)}
                          disabled={item.estoque != null && item.quantidade >= item.estoque}
                          className="px-2 py-1 text-[#666] hover:bg-[#f5f5f5] disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Aumentar quantidade"
                          title={item.estoque != null && item.quantidade >= item.estoque ? 'Máximo disponível em estoque' : undefined}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="font-barlow font-black text-[15px] text-[#111]">
                        {formatPrice(item.preco * item.quantidade)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removerItem(item.id)}
                    aria-label={`Remover ${item.nome}`}
                    className="self-start p-1.5 text-[#bbb] hover:text-[#d42b2b] transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            {/* Rodapé: subtotal + CTAs */}
            <div className="border-t border-[#eee] px-5 py-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <span className="font-inter text-sm text-[#666]">Subtotal</span>
                <span className="font-barlow font-black text-2xl text-[#111]">{formatPrice(total)}</span>
              </div>
              <p className="text-[11px] text-[#999] font-inter -mt-2">Frete calculado no checkout</p>
              <Link
                href="/checkout"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#d42b2b] hover:bg-red-700 text-white font-barlow font-bold uppercase text-sm tracking-wider transition-colors"
              >
                Finalizar compra
                <ArrowRight size={16} />
              </Link>
              <div className="flex items-center justify-between text-[13px] font-semibold">
                <Link href="/carrinho" className="text-[#666] hover:text-[#111] transition-colors">
                  Ver carrinho completo
                </Link>
                <button onClick={fecharDrawer} className="text-[#d42b2b] hover:underline">
                  Continuar comprando
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
