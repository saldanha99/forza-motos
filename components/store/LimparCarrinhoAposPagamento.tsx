'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/store/cart'

/**
 * Limpa o carrinho somente depois que o Mercado Pago retorna para um pedido
 * conhecido. Esperar a hidratação evita que o localStorage restaure os itens
 * logo após a limpeza.
 */
export function LimparCarrinhoAposPagamento() {
  const hidratado = useCartStore((state) => state._hasHydrated)
  const limpar = useCartStore((state) => state.limpar)

  useEffect(() => {
    if (hidratado) limpar()
  }, [hidratado, limpar])

  return null
}
