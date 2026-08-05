'use client'

import Image from 'next/image'
import { PackageX } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { KanbanBoard, type ColunaKanban, type ItemKanban } from './KanbanBoard'
import { Badge } from '@/components/admin/ui/primitives'

export type ProdutoKanban = ItemKanban & {
  nome: string
  categoria: string
  preco: number
  estoque: number
  imagem: string | null
  fornecedor: string | null
  /** Motivos de bloqueio — usados só pra exibir o badge no card. */
  semImagem: boolean
  semEstoque: boolean
}

/**
 * A coluna "bloqueado" é derivada dos flags do produto, não de um campo do
 * banco: some das outras duas quando falta imagem, ou quando falta estoque
 * e o produto não é sob encomenda (Eurolaqui).
 */
export const COLUNAS_CURADORIA: ColunaKanban[] = [
  {
    id: 'loja',
    titulo: 'Na loja',
    tom: 'success',
    vazio: 'Arraste um produto oculto para cá para colocá-lo à venda.',
  },
  {
    id: 'oculto',
    titulo: 'Oculto',
    tom: 'neutro',
    vazio: 'Produtos tirados manualmente da loja ficam aqui — o robô do Olist respeita essa decisão.',
  },
  {
    id: 'bloqueado',
    titulo: 'Bloqueado',
    tom: 'danger',
    bloqueada: true,
    vazio:
      'Vazio por enquanto. Produtos sem foto — ou sem estoque e que não são sob encomenda (Eurolaqui) — caem aqui e não podem ir pra loja mesmo que você queira.',
  },
]

async function alterarVisibilidade(id: string, visivel: boolean): Promise<void> {
  const r = await fetch(`/api/admin/produtos/${id}/curadoria`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visivel }),
  })
  if (!r.ok) {
    const { error } = await r.json().catch(() => ({ error: '' }))
    throw new Error(error || 'O servidor recusou a mudança de visibilidade.')
  }
}

export function CuradoriaKanban({ produtos }: { produtos: ProdutoKanban[] }) {
  return (
    <KanbanBoard<ProdutoKanban>
      colunas={COLUNAS_CURADORIA}
      itens={produtos}
      // A coluna "bloqueado" não aceita drop (ver bloqueada: true acima), então
      // só existem dois destinos possíveis: loja (visivel) ou oculto.
      onMover={(p, para) => alterarVisibilidade(p.id, para === 'loja')}
      renderCard={(p) => (
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-brand-hair bg-brand-surface-2">
              {p.imagem ? (
                <Image src={p.imagem} alt="" fill sizes="44px" className="object-contain p-1" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-brand-dim">
                  <PackageX size={16} />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-text" title={p.nome}>
                {p.nome}
              </p>
              <p className="truncate text-xs text-brand-muted">{p.categoria}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-brand-dim">
            <span className="font-barlow text-sm font-bold tabular-nums text-brand-text">
              {formatPrice(p.preco)}
            </span>
            <span>{p.estoque} em estoque</span>
          </div>

          {(p.semImagem || p.semEstoque || p.fornecedor === 'eurolaqui') && (
            <div className="flex flex-wrap gap-1">
              {p.semImagem && <Badge tom="danger">Sem imagem</Badge>}
              {p.semEstoque && <Badge tom="danger">Sem estoque</Badge>}
              {p.fornecedor === 'eurolaqui' && <Badge tom="info">Sob encomenda</Badge>}
            </div>
          )}
        </div>
      )}
    />
  )
}
