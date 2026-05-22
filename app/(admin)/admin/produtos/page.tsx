export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Plus } from 'lucide-react'
import { SyncProdutoButton } from '@/components/admin/SyncProdutoButton'

export const metadata = { title: 'Produtos — Forza Admin' }

export default async function ProdutosAdminPage({ searchParams }: { searchParams: { busca?: string } }) {
  const produtos = await prisma.product.findMany({
    where: searchParams.busca
      ? { OR: [{ nome: { contains: searchParams.busca, mode: 'insensitive' } }, { sku: { contains: searchParams.busca, mode: 'insensitive' } }] }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Produtos</h1>
        <Link
          href="/admin/produtos/novo"
          className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-accent to-brand-accent-hover hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md shadow-brand-accent/20"
        >
          <Plus size={16} /> Novo produto
        </Link>
      </div>

      {/* Busca */}
      <form className="mb-6">
        <input
          name="busca"
          defaultValue={searchParams.busca}
          placeholder="Buscar por nome ou SKU..."
          className="w-full max-w-sm bg-white/5 border border-white/10 hover:border-white/20 focus:border-brand-accent/50 focus:bg-white/[0.08] rounded-xl px-4 py-2.5 text-brand-text text-sm placeholder:text-brand-muted/70 focus:outline-none transition-all duration-200"
        />
      </form>

      <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto admin-scroll">
          <table className="w-full text-sm">
            <thead className="border-b border-brand-border/20 bg-white/[0.01]">
              <tr className="text-xs text-brand-muted uppercase tracking-widest">
                <th className="text-left px-6 py-3 font-medium">Produto</th>
                <th className="text-left px-6 py-3 font-medium">SKU</th>
                <th className="text-left px-6 py-3 font-medium">Preço</th>
                <th className="text-left px-6 py-3 font-medium">Estoque</th>
                <th className="text-left px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-b border-brand-border/10 hover:bg-white/[0.04] transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="font-medium text-brand-text">{p.nome}</div>
                    <div className="text-xs text-brand-muted">{p.marca} · {p.categoria}</div>
                  </td>
                  <td className="px-6 py-3.5 text-brand-muted font-mono text-xs">{p.sku}</td>
                  <td className="px-6 py-3.5 text-brand-text">{formatPrice(Number(p.preco))}</td>
                  <td className="px-6 py-3.5">
                    <span className={`font-semibold ${p.estoque < 5 ? 'text-yellow-400' : 'text-brand-muted'}`}>
                      {p.estoque}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex gap-2 flex-wrap">
                      {p.ativo ? (
                        <Badge variant="success">Ativo</Badge>
                      ) : (
                        <Badge variant="danger">Inativo</Badge>
                      )}
                      {p.destaque && <Badge variant="info">Destaque</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-2">
                      <SyncProdutoButton produtoId={p.id} hasTinyId={!!p.tinyId} />
                      <Link href={`/admin/produtos/${p.id}`} className="text-xs text-brand-muted hover:text-brand-text transition-colors">
                        Editar →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
