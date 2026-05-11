import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { FiltrosProdutos } from '@/components/store/FiltrosProdutos'

interface SearchParams {
  [key: string]: string | undefined
  categoria?: string
  marca?: string
  minPreco?: string
  maxPreco?: string
  busca?: string
  page?: string
}

async function getProdutos(params: SearchParams) {
  const where: any = { ativo: true }

  if (params.busca) {
    where.OR = [
      { nome: { contains: params.busca, mode: 'insensitive' } },
      { descricao: { contains: params.busca, mode: 'insensitive' } },
    ]
  }
  if (params.categoria) where.categoria = { equals: params.categoria, mode: 'insensitive' }
  if (params.marca) where.marca = { equals: params.marca, mode: 'insensitive' }
  if (params.minPreco || params.maxPreco) {
    where.preco = {}
    if (params.minPreco) where.preco.gte = Number(params.minPreco)
    if (params.maxPreco) where.preco.lte = Number(params.maxPreco)
  }

  const page = Number(params.page ?? 1)
  const pageSize = 24
  const skip = (page - 1) * pageSize

  const [produtos, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
    prisma.product.count({ where }),
  ])

  return { produtos, total, pages: Math.ceil(total / pageSize) }
}

async function getFiltrosDisponiveis() {
  const [categorias, marcas] = await Promise.all([
    prisma.product.findMany({ where: { ativo: true }, select: { categoria: true }, distinct: ['categoria'] }),
    prisma.product.findMany({ where: { ativo: true }, select: { marca: true }, distinct: ['marca'] }),
  ])
  return {
    categorias: categorias.map((c) => c.categoria),
    marcas: marcas.map((m) => m.marca),
  }
}

export const metadata = { title: 'Produtos' }

export default async function ProdutosPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ produtos, total, pages }, filtros] = await Promise.all([
    getProdutos(searchParams),
    getFiltrosDisponiveis(),
  ])

  const paginaAtual = Number(searchParams.page ?? 1)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="font-rajdhani font-bold text-4xl text-white mb-2 uppercase tracking-wide">
        Produtos
      </h1>
      <p className="text-zinc-500 text-sm mb-8">{total} produto{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Filtros */}
        <aside className="lg:w-64 shrink-0">
          <FiltrosProdutos
            categorias={filtros.categorias}
            marcas={filtros.marcas}
            params={searchParams}
          />
        </aside>

        {/* Grid */}
        <div className="flex-1">
          {produtos.length === 0 ? (
            <div className="text-center py-20 text-zinc-500">
              <p className="text-4xl mb-4">🔍</p>
              <p>Nenhum produto encontrado com esses filtros.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {produtos.map((p) => (
                  <ProductCard key={p.id} produto={p} />
                ))}
              </div>

              {/* Paginação */}
              {pages > 1 && (
                <div className="flex justify-center gap-2 mt-10">
                  {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                    <a
                      key={p}
                      href={`?${new URLSearchParams({ ...searchParams, page: String(p) })}`}
                      className={`w-9 h-9 flex items-center justify-center rounded text-sm transition-colors ${
                        p === paginaAtual
                          ? 'bg-vermelho text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {p}
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
