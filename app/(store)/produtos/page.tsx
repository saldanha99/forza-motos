export const dynamic = 'force-dynamic'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/ProductCard'
import { FiltrosProdutos, FiltrosMobile } from '@/components/store/FiltrosProdutos'
import { Package } from 'lucide-react'

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
  const where: any = { ativo: true, estoque: { gt: 0 }, preco: { gt: 0 } }

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
  const filtroBase = { ativo: true, estoque: { gt: 0 }, preco: { gt: 0 } }
  const [categorias, marcas] = await Promise.all([
    prisma.product.findMany({ where: filtroBase, select: { categoria: true }, distinct: ['categoria'] }),
    prisma.product.findMany({ where: filtroBase, select: { marca: true }, distinct: ['marca'] }),
  ])
  return {
    categorias: categorias.map((c) => c.categoria).filter(Boolean) as string[],
    marcas: marcas.map((m) => m.marca).filter(Boolean) as string[],
  }
}

export const metadata = { title: 'Produtos' }

export default async function ProdutosPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ produtos, total, pages }, filtros] = await Promise.all([
    getProdutos(searchParams),
    getFiltrosDisponiveis(),
  ])

  const paginaAtual = Number(searchParams.page ?? 1)

  // Active filter chips
  const activeFilters: { label: string; removeKey: string }[] = []
  if (searchParams.busca) activeFilters.push({ label: `"${searchParams.busca}"`, removeKey: 'busca' })
  if (searchParams.categoria) activeFilters.push({ label: searchParams.categoria, removeKey: 'categoria' })
  if (searchParams.marca) activeFilters.push({ label: searchParams.marca, removeKey: 'marca' })
  if (searchParams.minPreco || searchParams.maxPreco) {
    activeFilters.push({
      label: `R$ ${searchParams.minPreco ?? '0'} – ${searchParams.maxPreco ?? '∞'}`,
      removeKey: 'preco',
    })
  }

  function buildFilterUrl(removeKey: string) {
    const q = { ...searchParams }
    if (removeKey === 'preco') { delete q.minPreco; delete q.maxPreco }
    else delete q[removeKey]
    delete q.page
    const params = new URLSearchParams()
    Object.entries(q).forEach(([k, v]) => { if (v) params.set(k, v) })
    const qs = params.toString()
    return `/produtos${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)' }}>

      {/* ── Sticky glass top bar ─────────────────────────── */}
      <div
        className="sticky top-0 z-30 border-b"
        style={{
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: 'rgba(255,255,255,0.85)',
          borderColor: 'rgba(0,0,0,0.08)',
        }}
      >
        {/* Row 1: título + botão filtros */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-2 flex items-center gap-3">
          <div className="flex items-baseline gap-2 flex-1 min-w-0">
            <h1 className="font-rajdhani font-bold text-xl truncate" style={{ color: 'var(--ink)' }}>
              Produtos
            </h1>
            <span className="text-xs font-medium rounded-full px-2 py-0.5 shrink-0" style={{
              background: 'rgba(212,43,43,0.10)',
              color: 'var(--vermelho)',
            }}>
              {total}
            </span>
          </div>

          {/* Botão filtros — só mobile */}
          <div className="lg:hidden shrink-0">
            <FiltrosMobile categorias={filtros.categorias} marcas={filtros.marcas} params={searchParams} />
          </div>
        </div>

        {/* Row 2: chips de filtros ativos (só se houver) */}
        {activeFilters.length > 0 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-2 flex flex-wrap gap-1.5">
            {activeFilters.map((f) => (
              <Link
                key={f.removeKey}
                href={buildFilterUrl(f.removeKey)}
                className="flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-200 hover:opacity-80"
                style={{
                  background: 'rgba(212,43,43,0.10)',
                  color: 'var(--vermelho)',
                  border: '1px solid rgba(212,43,43,0.20)',
                }}
              >
                {f.label}
                <span className="text-[10px] ml-0.5 opacity-70">×</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Main layout ─────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 lg:py-8">
        <div className="lg:flex lg:gap-8">

          {/* Sidebar — apenas desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <FiltrosProdutos
              categorias={filtros.categorias}
              marcas={filtros.marcas}
              params={searchParams}
            />
          </aside>

          {/* Grid area */}
          <div className="flex-1 min-w-0">
            {produtos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div
                  className="rounded-2xl p-10 flex flex-col items-center text-center max-w-sm"
                  style={{
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    background: 'rgba(255,255,255,0.60)',
                    border: '1px solid rgba(255,255,255,0.40)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                  }}
                >
                  <Package
                    size={48}
                    strokeWidth={1.2}
                    style={{ color: 'var(--dim)', marginBottom: '16px' }}
                  />
                  <p
                    className="font-semibold text-base mb-1"
                    style={{ color: 'var(--ink)' }}
                  >
                    Nenhum produto encontrado
                  </p>
                  <p className="text-sm" style={{ color: 'var(--dim)' }}>
                    Tente ajustar ou limpar os filtros aplicados.
                  </p>
                  <Link
                    href="/produtos"
                    className="mt-5 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200"
                    style={{
                      background: 'var(--vermelho)',
                      color: '#fff',
                      boxShadow: '0 2px 12px rgba(212,43,43,0.30)',
                    }}
                  >
                    Ver todos
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 lg:gap-5">
                  {produtos.map((p) => (
                    <ProductCard key={p.id} produto={p} />
                  ))}
                </div>

                {/* Pagination */}
                {pages > 1 && (
                  <div className="flex justify-center gap-2 mt-12">
                    {Array.from({ length: pages }, (_, i) => i + 1).map((p) => {
                      const isActive = p === paginaAtual
                      const href = `/produtos?${new URLSearchParams({ ...searchParams, page: String(p) })}`
                      return (
                        <a
                          key={p}
                          href={href}
                          className="w-9 h-9 flex items-center justify-center rounded-full text-sm font-semibold transition-all duration-200"
                          style={
                            isActive
                              ? {
                                  background: 'var(--vermelho)',
                                  color: '#fff',
                                  boxShadow: '0 2px 12px rgba(212,43,43,0.35)',
                                }
                              : {
                                  backdropFilter: 'blur(8px)',
                                  WebkitBackdropFilter: 'blur(8px)',
                                  background: 'rgba(255,255,255,0.60)',
                                  border: '1px solid rgba(255,255,255,0.40)',
                                  color: 'var(--dim)',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                }
                          }
                        >
                          {p}
                        </a>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
