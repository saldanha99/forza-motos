export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { FadeIn } from '@/components/admin/FadeIn'
import { CuradoriaToggle } from '@/components/admin/CuradoriaToggle'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import Image from 'next/image'
import { PackageX, Info } from 'lucide-react'

export const metadata = { title: 'Curadoria — Forza Admin' }

const POR_PAGINA = 60

export default async function CuradoriaPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; manter?: string }
}) {
  const q = searchParams.q?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const soMantidos = searchParams.manter === '1'

  // Foco: produtos de fornecedor bloqueado (Eurolaqui) — os que saem por padrão
  const where: any = { fornecedor: 'eurolaqui' }
  if (q) where.nome = { contains: q, mode: 'insensitive' }
  if (soMantidos) where.mantidoManual = true

  const [produtos, total, totalEuro, totalMantidos] = await Promise.all([
    prisma.product.findMany({
      where,
      select: { id: true, nome: true, sku: true, categoria: true, preco: true, imagens: true, mantidoManual: true, temImagem: true },
      orderBy: [{ mantidoManual: 'desc' }, { nome: 'asc' }],
      skip: (page - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
    prisma.product.count({ where }),
    prisma.product.count({ where: { fornecedor: 'eurolaqui' } }),
    prisma.product.count({ where: { fornecedor: 'eurolaqui', mantidoManual: true } }),
  ])

  const pages = Math.ceil(total / POR_PAGINA)
  const qs = (p: Record<string, string>) =>
    '?' + new URLSearchParams({ ...(q && { q }), ...(soMantidos && { manter: '1' }), ...p }).toString()

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-barlow font-black text-4xl text-brand-text tracking-tight">Curadoria de produtos</h1>
        <p className="text-brand-muted text-sm mt-1">
          Produtos do fornecedor <strong>Eurolaqui</strong> saem da loja por padrão. Marque aqui os que você quer <strong>manter</strong>.
        </p>
      </div>

      {/* Resumo */}
      <FadeIn delay={0} className="mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl px-5 py-3">
            <p className="font-barlow font-black text-2xl text-brand-text">{totalEuro}</p>
            <p className="text-xs text-brand-muted">produtos Eurolaqui</p>
          </div>
          <div className="admin-glass !bg-emerald-500/[0.06] border border-emerald-500/30 rounded-2xl px-5 py-3">
            <p className="font-barlow font-black text-2xl text-emerald-400">{totalMantidos}</p>
            <p className="text-xs text-brand-muted">mantidos na loja</p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-xs text-brand-muted/80 mt-3">
          <Info size={13} />
          O robô ainda está classificando o catálogo — este número cresce conforme ele varre o Olist.
        </p>
      </FadeIn>

      {/* Filtros */}
      <FadeIn delay={80} className="mb-4">
        <form className="flex flex-wrap gap-2" action="/admin/curadoria">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome…"
            className="flex-1 min-w-[200px] rounded-xl bg-white/[0.03] border border-brand-border/30 px-4 py-2.5 text-sm text-brand-text outline-none focus:border-brand-accent/40"
          />
          {soMantidos && <input type="hidden" name="manter" value="1" />}
          <button className="px-4 py-2.5 rounded-xl bg-brand-accent/90 hover:bg-brand-accent text-white text-sm font-semibold">
            Buscar
          </button>
          <Link
            href={soMantidos ? '/admin/curadoria' : '/admin/curadoria?manter=1'}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${
              soMantidos
                ? 'bg-emerald-500/90 border-emerald-500 text-white'
                : 'bg-white/5 border-brand-border/30 text-brand-muted hover:text-brand-text'
            }`}
          >
            Só mantidos
          </Link>
        </form>
      </FadeIn>

      {/* Lista */}
      {produtos.length === 0 ? (
        <div className="admin-glass !bg-black/20 border border-brand-border/30 rounded-2xl px-6 py-16 text-center">
          <PackageX size={40} className="text-brand-muted/50 mx-auto mb-3" />
          <p className="text-brand-muted">
            {totalEuro === 0
              ? 'Nenhum produto Eurolaqui classificado ainda — aguarde o robô terminar a varredura.'
              : 'Nada encontrado com esse filtro.'}
          </p>
        </div>
      ) : (
        <FadeIn delay={160}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {produtos.map((p) => {
              const img = Array.isArray(p.imagens) ? (p.imagens[0] as string) : null
              return (
                <div
                  key={p.id}
                  className={`admin-glass !bg-black/20 border rounded-2xl p-3 flex gap-3 items-center ${
                    p.mantidoManual ? 'border-emerald-500/40' : 'border-brand-border/30'
                  }`}
                >
                  <div className="relative w-14 h-14 rounded-lg bg-white/5 border border-brand-border/20 shrink-0 overflow-hidden">
                    {img && <Image src={img} alt="" fill sizes="56px" className="object-contain p-1" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-brand-text font-medium leading-tight line-clamp-2">{p.nome}</p>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      {p.categoria} · {formatPrice(Number(p.preco))}
                      {!p.temImagem && <span className="text-amber-400"> · sem foto</span>}
                    </p>
                  </div>
                  <CuradoriaToggle produtoId={p.id} inicial={p.mantidoManual} />
                </div>
              )
            })}
          </div>

          {/* Paginação */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6 text-sm">
              {page > 1 && (
                <Link href={qs({ page: String(page - 1) })} className="px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border/30 text-brand-muted hover:text-brand-text">
                  ← Anterior
                </Link>
              )}
              <span className="text-brand-muted">Página {page} de {pages}</span>
              {page < pages && (
                <Link href={qs({ page: String(page + 1) })} className="px-3 py-1.5 rounded-lg bg-white/5 border border-brand-border/30 text-brand-muted hover:text-brand-text">
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </FadeIn>
      )}
    </div>
  )
}
