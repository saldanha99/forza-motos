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
  /** Drawer lateral do carrinho (abre ao adicionar item) */
  drawerAberto: boolean
  abrirDrawer: () => void
  fecharDrawer: () => void
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
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
      drawerAberto: false,
      abrirDrawer: () => set({ drawerAberto: true }),
      fecharDrawer: () => set({ drawerAberto: false }),
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      adicionarItem: (item) =>
        set((state) => {
          const existe = state.items.find((i) => i.id === item.id)
          if (existe) {
            return {
              drawerAberto: true,
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantidade: i.quantidade + 1 } : i
              ),
            }
          }
          return { drawerAberto: true, items: [...state.items, { ...item, quantidade: 1 }] }
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
    {
      name: 'forza-cart',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
