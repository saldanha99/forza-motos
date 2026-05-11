import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  nome: string
  slug: string
  preco: number
  imagem?: string
  quantidade: number
}

interface CartStore {
  items: CartItem[]
  adicionarItem: (item: Omit<CartItem, 'quantidade'>) => void
  removerItem: (id: string) => void
  atualizarQuantidade: (id: string, quantidade: number) => void
  limpar: () => void
  subtotal: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      adicionarItem: (item) =>
        set((state) => {
          const existe = state.items.find((i) => i.id === item.id)
          if (existe) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantidade: i.quantidade + 1 } : i
              ),
            }
          }
          return { items: [...state.items, { ...item, quantidade: 1 }] }
        }),

      removerItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      atualizarQuantidade: (id, quantidade) =>
        set((state) => {
          if (quantidade <= 0) return { items: state.items.filter((i) => i.id !== id) }
          return {
            items: state.items.map((i) => (i.id === id ? { ...i, quantidade } : i)),
          }
        }),

      limpar: () => set({ items: [] }),

      subtotal: () =>
        get().items.reduce((acc, i) => acc + i.preco * i.quantidade, 0),
    }),
    { name: 'forza-cart' }
  )
)
