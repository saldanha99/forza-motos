import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string
  nome: string
  slug: string
  preco: number
  imagem?: string
  quantidade: number
  /** Estoque disponível no momento em que o item entrou no carrinho — teto da quantidade */
  estoque?: number
}

interface CartStore {
  items: CartItem[]
  /** Drawer lateral do carrinho (abre ao adicionar item) */
  drawerAberto: boolean
  abrirDrawer: () => void
  fecharDrawer: () => void
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  adicionarItem: (item: Omit<CartItem, 'quantidade'>, quantidade?: number) => void
  removerItem: (id: string) => void
  atualizarQuantidade: (id: string, quantidade: number) => void
  limpar: () => void
  subtotal: () => number
}

/** Nunca deixa a quantidade passar do estoque conhecido do item */
function limitarAoEstoque(quantidade: number, estoque?: number): number {
  if (typeof estoque === 'number' && estoque >= 0) return Math.min(quantidade, estoque)
  return quantidade
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

      adicionarItem: (item, quantidade = 1) =>
        set((state) => {
          const existe = state.items.find((i) => i.id === item.id)
          if (existe) {
            return {
              drawerAberto: true,
              items: state.items.map((i) =>
                i.id === item.id
                  ? { ...i, ...item, quantidade: limitarAoEstoque(i.quantidade + quantidade, item.estoque ?? i.estoque) }
                  : i
              ),
            }
          }
          return {
            drawerAberto: true,
            items: [...state.items, { ...item, quantidade: limitarAoEstoque(quantidade, item.estoque) }],
          }
        }),

      removerItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      atualizarQuantidade: (id, quantidade) =>
        set((state) => {
          if (quantidade <= 0) return { items: state.items.filter((i) => i.id !== id) }
          return {
            items: state.items.map((i) =>
              i.id === id ? { ...i, quantidade: limitarAoEstoque(quantidade, i.estoque) } : i
            ),
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
