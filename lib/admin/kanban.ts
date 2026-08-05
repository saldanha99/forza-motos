import type { TomStatus } from './status'

/**
 * Contrato dos quadros Kanban.
 *
 * Mora aqui, e não dentro dos componentes `'use client'`, porque as páginas
 * server (o dashboard, por exemplo) precisam ler as colunas. Importar um
 * *valor* de um módulo client num server component devolve um proxy de
 * referência — chamar `.filter()` nele estoura em runtime, não na build.
 * Só o tipo pode atravessar essa fronteira, porque é apagado na compilação.
 */

export type ColunaKanban = {
  /** Valor do status que esta coluna representa. */
  id: string
  /** Nome em linguagem de operação ("Pago — separar"), não o enum cru. */
  titulo: string
  tom: TomStatus
  /** O que faz um card cair aqui — vira o texto do estado vazio. */
  vazio?: string
  /** Coluna derivada/somente leitura: mostra, mas não aceita card. */
  bloqueada?: boolean
}

export type ItemKanban = {
  id: string
  coluna: string
  /** Usado no rodapé da coluna (soma de valores, por ex.). */
  valor?: number
  /** Texto curto que identifica o card nos avisos ("Pedido FM-2026-0042"). */
  rotulo: string
}

/* ═══════════════════════════════════════════════════════════════════
   Pedidos
   ═══════════════════════════════════════════════════════════════════ */

export const COLUNAS_PEDIDO: ColunaKanban[] = [
  {
    id: 'AGUARDANDO_PAGAMENTO',
    titulo: 'Aguardando pagamento',
    tom: 'warning',
    vazio: 'Pedidos entram aqui assim que o cliente fecha o carrinho e ainda não pagou.',
  },
  {
    id: 'CONFIRMADO',
    titulo: 'Pago — separar',
    tom: 'danger',
    vazio: 'Assim que o Mercado Pago aprovar, o pedido cai aqui para você separar.',
  },
  {
    id: 'SEPARANDO',
    titulo: 'Em separação',
    tom: 'warning',
    vazio: 'Arraste um pedido pago para cá quando começar a separar as peças.',
  },
  {
    id: 'ENVIADO',
    titulo: 'Enviado / a retirar',
    tom: 'info',
    vazio: 'Pedidos despachados nos Correios ou prontos no balcão ficam aqui.',
  },
  {
    id: 'ENTREGUE',
    titulo: 'Entregue',
    tom: 'success',
    vazio: 'Fim da linha: pedido entregue ou retirado pelo cliente.',
  },
  {
    id: 'CANCELADO',
    titulo: 'Cancelado',
    tom: 'neutro',
    vazio: 'Nenhum pedido cancelado no período.',
  },
]
