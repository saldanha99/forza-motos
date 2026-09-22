export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatPrice, cn } from '@/lib/utils'
import Link from 'next/link'
import { Package, Plus } from 'lucide-react'
import { SyncProdutoButton } from '@/components/admin/SyncProdutoButton'
import {
  PageHeader, BotaoLink, Badge, EmptyState, Tabela,
  THEAD_TH, TR_LINHA, TD_CELULA,
} from '@/components/admin/ui/primitives'
import { Input } from '@/components/admin/ui/form'

export const metadata = { title: 'Produtos — Forza Admin' }

export default async function ProdutosAdminPage(props: { searchParams: Promise<{ busca?: string }> }) {
  const searchParams = await props.searchParams;
  const produtos = await prisma.product.findMany({
    where: {
      // As ofertas da ação têm regras próprias de preço, prazo e pré-venda e
      // são mantidas somente no módulo dedicado para evitar edição acidental.
      eventoPirelliId: null,
      ...(searchParams.busca
        ? { OR: [{ nome: { contains: searchParams.busca, mode: 'insensitive' as const } }, { sku: { contains: searchParams.busca, mode: 'insensitive' as const } }] }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div>
      <PageHeader
        titulo="Produtos"
        descricao="Catálogo regular da loja — edite preço, estoque e visibilidade, ou sincronize o cadastro com o Tiny."
        acoes={
          <>
            <BotaoLink href="/admin/evento-pirelli/produtos" variante="secundario">
              Ofertas Pirelli
            </BotaoLink>
            <BotaoLink href="/admin/produtos/novo">
              <Plus size={16} /> Novo produto
            </BotaoLink>
          </>
        }
      />

      {/* Busca */}
      <form className="mb-6">
        <Input
          name="busca"
          defaultValue={searchParams.busca}
          placeholder="Buscar por nome ou SKU..."
          className="max-w-sm"
        />
      </form>

      {produtos.length === 0 ? (
        <EmptyState
          icone={Package}
          titulo="Nenhum produto encontrado"
          descricao="Produtos aparecem aqui quando cadastrados manualmente ou sincronizados do Tiny. Ajuste a busca ou cadastre um novo."
        />
      ) : (
        <Tabela
          cabecalho={
            <>
              <th className={THEAD_TH}>Produto</th>
              <th className={THEAD_TH}>SKU</th>
              <th className={THEAD_TH}>Preço</th>
              <th className={THEAD_TH}>Estoque</th>
              <th className={THEAD_TH}>Status</th>
              <th className={THEAD_TH} />
            </>
          }
        >
          {produtos.map((p) => {
            const naLoja = p.ativo && !p.ocultoManual
              && (p.fornecedor !== 'eurolaqui' || p.mantidoManual)

            return (
            <tr key={p.id} className={TR_LINHA}>
              <td className={TD_CELULA}>
                <div className="font-medium text-brand-text">{p.nome}</div>
                <div className="text-xs text-brand-muted">{p.marca} · {p.categoria}</div>
              </td>
              <td className={cn(TD_CELULA, 'font-mono text-xs text-brand-muted')}>{p.sku}</td>
              <td className={cn(TD_CELULA, 'text-brand-text')}>{formatPrice(Number(p.preco))}</td>
              <td className={TD_CELULA}>
                <span className={cn('font-semibold', p.estoque < 5 ? 'text-brand-warning' : 'text-brand-muted')}>
                  {p.estoque}
                </span>
              </td>
              <td className={TD_CELULA}>
                <div className="flex flex-wrap gap-2">
                  {naLoja ? (
                    <Badge tom="success">Na loja</Badge>
                  ) : p.ocultoManual ? (
                    <Badge tom="warning">Oculto</Badge>
                  ) : (
                    <Badge tom="danger">Inativo</Badge>
                  )}
                  {p.destaque && <Badge tom="info">Destaque</Badge>}
                </div>
              </td>
              <td className={TD_CELULA}>
                <div className="flex items-center gap-2">
                  <SyncProdutoButton produtoId={p.id} hasTinyId={!!p.tinyId} />
                  <Link
                    href={`/admin/produtos/${p.id}`}
                    className="text-xs text-brand-dim transition-colors hover:text-brand-accent"
                  >
                    Editar →
                  </Link>
                </div>
              </td>
            </tr>
            )
          })}
        </Tabela>
      )}
    </div>
  )
}
