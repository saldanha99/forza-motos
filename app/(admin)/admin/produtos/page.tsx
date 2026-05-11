import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Plus } from 'lucide-react'

export const metadata = { title: 'Produtos Admin' }

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
        <h1 className="font-rajdhani font-bold text-3xl text-white">Produtos</h1>
        <Link href="/admin/produtos/novo" className="inline-flex items-center gap-2 bg-vermelho hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-semibold transition-colors">
          <Plus size={16} /> Novo produto
        </Link>
      </div>

      {/* Busca */}
      <form className="mb-6">
        <input
          name="busca"
          defaultValue={searchParams.busca}
          placeholder="Buscar por nome ou SKU..."
          className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded px-3 py-2.5 text-white text-sm focus:outline-none focus:border-vermelho"
        />
      </form>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950">
              <tr className="text-xs text-zinc-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Produto</th>
                <th className="text-left px-5 py-3">SKU</th>
                <th className="text-left px-5 py-3">Preço</th>
                <th className="text-left px-5 py-3">Estoque</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{p.nome}</div>
                    <div className="text-xs text-zinc-600">{p.marca} · {p.categoria}</div>
                  </td>
                  <td className="px-5 py-3 text-zinc-500 font-mono text-xs">{p.sku}</td>
                  <td className="px-5 py-3 text-white">{formatPrice(Number(p.preco))}</td>
                  <td className="px-5 py-3">
                    <span className={`font-medium ${p.estoque < 5 ? 'text-yellow-400' : 'text-zinc-400'}`}>
                      {p.estoque}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2 flex-wrap">
                      {p.ativo ? (
                        <Badge variant="success">Ativo</Badge>
                      ) : (
                        <Badge variant="danger">Inativo</Badge>
                      )}
                      {p.destaque && <Badge variant="info">Destaque</Badge>}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/produtos/${p.id}`} className="text-xs text-zinc-500 hover:text-white">
                      Editar →
                    </Link>
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
