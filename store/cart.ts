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
  /** Metadados de UX da campanha; o servidor nunca confia neles para conceder o brinde. */
  eventoPirelli?: boolean
  categoria?: string
  valorMinimoBrindeEvento?: number
  operadorValorMinimoBrindeEvento?: 'MAIOR_QUE' | 'MAIOR_OU_IGUAL'
  limiteNomeGravacaoEvento?: number
}

interface CartStore {
  items: CartItem[]
  /** Item aguardando confirmação quando o cliente tenta misturar campanhas. */
  trocaPendente: { item: Omit<CartItem, 'quantidade'>; quantidade: number } | null
  /** Drawer lateral do carrinho (abre ao adicionar item) */
  drawerAberto: boolean
  abrirDrawer: () => void
  fecharDrawer: () => void
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  adicionarItem: (item: Omit<CartItem, 'quantidade'>, quantidade?: number) => boolean
  confirmarTrocaCarrinho: () => void
  cancelarTrocaCarrinho: () => void
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
      trocaPendente: null,
      drawerAberto: false,
      abrirDrawer: () => set({ drawerAberto: true }),
      fecharDrawer: () => set({ drawerAberto: false }),
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      adicionarItem: (item, quantidade = 1) => {
        const state = get()
        const carrinhoEhEvento = state.items.some((atual) => atual.eventoPirelli === true)
        const itemEhEvento = item.eventoPirelli === true

        // Produtos da campanha têm regras próprias de pré-venda, benefício e
        // entrega. Impedir a mistura aqui evita que o cliente descubra a
        // incompatibilidade somente no último passo do checkout.
        if (state.items.length > 0 && carrinhoEhEvento !== itemEhEvento) {
          set({
            drawerAberto: true,
            trocaPendente: { item, quantidade },
          })
          return false
        }

        set((atual) => {
          const existe = atual.items.find((i) => i.id === item.id)
          if (existe) {
            return {
              drawerAberto: true,
              trocaPendente: null,
              items: atual.items.map((i) =>
                i.id === item.id
                  ? { ...i, ...item, quantidade: limitarAoEstoque(i.quantidade + quantidade, item.estoque ?? i.estoque) }
                  : i
              ),
            }
          }
          return {
            drawerAberto: true,
            trocaPendente: null,
            items: [...atual.items, { ...item, quantidade: limitarAoEstoque(quantidade, item.estoque) }],
          }
        })
        return true
      },

      confirmarTrocaCarrinho: () => set((state) => {
        if (!state.trocaPendente) return state
        const { item, quantidade } = state.trocaPendente
        return {
          items: [{ ...item, quantidade: limitarAoEstoque(quantidade, item.estoque) }],
          trocaPendente: null,
          drawerAberto: true,
        }
      }),

      cancelarTrocaCarrinho: () => set({ trocaPendente: null }),

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

      limpar: () => set({ items: [], trocaPendente: null }),

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
