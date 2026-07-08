export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { FadeIn } from '@/components/admin/FadeIn'
import { CuradoriaToggle } from '@/components/admin/CuradoriaToggle'
import { CuradoriaBulkActions } from '@/components/admin/CuradoriaBulkActions'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { PackageX } from 'lucide-react'

export const metadata = { title: 'Curadoria — Forza Admin' }

const POR_PAGINA = 60

export default async function CuradoriaPage({
  searchParams,
}: {
  searchParams: { cat?: string; q?: string; page?: string; estado?: string }
}) {
  const cat = searchParams.cat ?? ''
  const q = searchParams.q?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const estado = searchParams.estado ?? 'todos' // todos | loja | ocultos

  // Categorias com contagem (todas, inclusive as sem produto ativo)
  const catsRaw = await prisma.product.groupBy({
    by: ['categoria'],
    where: { tinyId: { not: null } },
    _count: true,
    orderBy: { _count: { categoria: 'desc' } },
  })
  const categorias = catsRaw
    .filter((c) => c.categoria)
    .map((c) => ({ nome: c.categoria, total: c._count }))

  // Produtos da categoria selecionada (ou busca global)
  const where: any = { tinyId: { not: null }, ehPai: false }
  if (cat) where.categoria = cat
  if (q) where.nome = { contains: q, mode: 'insensitive' }
  if (estado === 'loja') where.ativo = true
  if (estado === 'ocultos') where.OR = [{ ativo: false }, { ocultoManual: true }]

  const [produtos, total] = cat || q
    ? await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true, nome: true, categoria: true, preco: true, imagens: true,
            ativo: true, estoque: true, temImagem: true, fornecedor: true,
            mantidoManual: true, ocultoManual: true,
          },
          orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
          skip: (page - 1) * POR_PAGINA,
          take: POR_PAGINA,
        }),
        prisma.product.count({ where }),
      ])
    : [[], 0]

  const pages = Math.ceil(total / POR_PAGINA)
  const qs = (p: Record<string, string>) =>
    '?' + new URLSearchParams({ ...(cat && { cat }), ...(q && { q }), ...(estado !== 'todos' && { estado }), ...p }).toString()

  // Um produto está "na loja" se ativo; Eurolaqui só se mantidoManual
  const estaNaLoja = (p: any) => p.ativo && !p.ocultoManual && (p.fornecedor !== 'eurolaqui' || p.mantidoManual)

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Curadoria de produtos</h1>
        <p className="text-brand-muted text-sm mt-1">
          Escolha o que fica na loja — por categoria. Você pode ocultar um produto mesmo estando ativo no Olist,
          e o robô respeita a sua decisão.
        </p>
      </div>

      {/* Categorias */}
      <FadeIn delay={0} className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brand-muted/70 mb-2">Categorias</p>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <Link
              key={c.nome}
              href={`/admin/curadoria?cat=${encodeURIComponent(c.nome)}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                cat === c.nome
                  ? 'bg-brand-accent border-brand-accent text-white'
                  : 'bg-white/5 border-brand-border/30 text-brand-muted hover:text-brand-text hover:border-brand-accent/40'
              }`}
            >
              {c.nome} <span className="opacity-60">({c.total})</span>
            </Link>
          ))}
        </div>
      </FadeIn>

      {/* Busca + filtro de estado */}
      <FadeIn delay={80} className="mb-4">
        <form className="flex flex-wrap gap-2" action="/admin/curadoria">
          {cat && <input type="hidden" name="cat" value={cat} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome…"
            className="flex-1 min-w-[200px] rounded-xl bg-white/[0.03] border border-brand-border/30 px-4 py-2.5 text-sm text-brand-text outline-none focus:border-brand-accent/40"
          />
          <button className="px-4 py-2.5 rounded-xl bg-brand-accent/90 hover:bg-brand-accent text-white text-sm font-semibold">
            Buscar
          </button>
          {(['todos', 'loja', 'ocultos'] as const).map((e) => {
            const params = new URLSearchParams()
            if (cat) params.set('cat', cat)
            if (q) params.set('q', q)
            if (e !== 'todos') params.set('estado', e)
            return (
              <Link
                key={e}
                href={`/admin/curadoria?${params.toString()}`}
                className={`px-3 py-2.5 rounded-xl text-sm font-semibold border ${
                  estado === e ? 'bg-emerald-500/90 border-emerald-500 text-white' : 'bg-white/5 border-brand-border/30 text-brand-muted hover:text-brand-text'
                }`}
              >
                {e === 'todos' ? 'Todos' : e === 'loja' ? 'Na loja' : 'Ocultos'}
              </Link>
            )
          })}
        </form>
      </FadeIn>

      {/* Lista */}
      {!cat && !q ? (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl px-6 py-16 text-center">
          <p className="text-brand-muted">Selecione uma categoria acima para curar os produtos.</p>
        </div>
      ) : produtos.length === 0 ? (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl px-6 py-16 text-center">
          <PackageX size={40} className="text-brand-muted/50 mx-auto mb-3" />
          <p className="text-brand-muted">Nada encontrado com esse filtro.</p>
        </div>
      ) : (
        <FadeIn delay={160}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-xs text-brand-muted">{total} produto{total !== 1 ? 's' : ''}</p>
            <CuradoriaBulkActions cat={cat} q={q} estado={estado} total={total} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {produtos.map((p) => {
              const img = Array.isArray(p.imagens) ? (p.imagens[0] as string) : null
              const naLoja = estaNaLoja(p)
              return (
                <div
                  key={p.id}
                  className={`admin-glass !bg-black/20 border rounded-2xl p-3 flex gap-3 items-center ${
                    naLoja ? 'border-emerald-500/30' : 'border-brand-border/30'
                  }`}
                >
                  <div className="relative w-14 h-14 rounded-lg bg-white/5 border border-brand-border/20 shrink-0 overflow-hidden">
                    {img && <Image src={img} alt="" fill sizes="56px" className="object-contain p-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-text font-medium leading-tight line-clamp-2">{p.nome}</p>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      {formatPrice(Number(p.preco))}
                      {p.fornecedor === 'eurolaqui' && <span className="text-amber-400"> · Eurolaqui</span>}
                      {!p.temImagem && <span className="text-amber-400"> · sem foto</span>}
                    </p>
                  </div>
                  <CuradoriaToggle produtoId={p.id} inicial={naLoja} />
                </div>
              )
            })}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6 text-sm">
              {page > 1 && (
                <Link href={qs({ page: String(page - 1) })} className="px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border/30 text-brand-muted hover:text-brand-text">← Anterior</Link>
              )}
              <span className="text-brand-muted">Página {page} de {pages}</span>
              {page < pages && (
                <Link href={qs({ page: String(page + 1) })} className="px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border/30 text-brand-muted hover:text-brand-text">Próxima →</Link>
              )}
            </div>
          )}
        </FadeIn>
      )}
    </div>
  )
}
