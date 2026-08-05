export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Image from 'next/image'
import { KanbanSquare, LayoutGrid, PackageX } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { cn, formatPrice } from '@/lib/utils'
import { CuradoriaToggle } from '@/components/admin/CuradoriaToggle'
import { CuradoriaBulkActions } from '@/components/admin/CuradoriaBulkActions'
import { CuradoriaKanban, type ProdutoKanban } from '@/components/admin/kanban/CuradoriaKanban'
import { PageHeader, EmptyState, FilterChip, Card, Botao } from '@/components/admin/ui/primitives'

export const metadata = { title: 'Curadoria — Forza Admin' }

const POR_PAGINA = 60
/** O quadro só cabe até aqui na tela — acima disso, peça um recorte melhor. */
const LIMITE_QUADRO = 120

type Vista = 'quadro' | 'grade'

function AlternadorVista({
  vista,
  qs,
}: {
  vista: Vista
  qs: (overrides: Record<string, string>) => string
}) {
  const opcoes = [
    { id: 'quadro' as const, label: 'Quadro', icone: KanbanSquare },
    { id: 'grade' as const, label: 'Grade', icone: LayoutGrid },
  ]

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-brand-border bg-brand-surface-2 p-0.5">
      {opcoes.map((o) => (
        <Link
          key={o.id}
          href={qs({ vista: o.id, page: '1' })}
          aria-current={vista === o.id ? 'page' : undefined}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            vista === o.id
              ? 'bg-brand-accent text-brand-on-accent shadow-cta'
              : 'text-brand-muted hover:text-brand-text',
          )}
        >
          <o.icone size={13} />
          {o.label}
        </Link>
      ))}
    </div>
  )
}

/** Deriva a coluna do quadro a partir dos mesmos flags que a API de curadoria usa. */
function colunaDoProduto(p: {
  temImagem: boolean
  estoque: number
  fornecedor: string | null
  ativo: boolean
}): 'bloqueado' | 'loja' | 'oculto' {
  const semEstoque = p.estoque <= 0 && p.fornecedor !== 'eurolaqui'
  if (!p.temImagem || semEstoque) return 'bloqueado'
  return p.ativo ? 'loja' : 'oculto'
}

export default async function CuradoriaPage({
  searchParams,
}: {
  searchParams: { cat?: string; q?: string; page?: string; estado?: string; vista?: string }
}) {
  const cat = searchParams.cat ?? ''
  const q = searchParams.q?.trim() ?? ''
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const estado = searchParams.estado ?? 'todos' // todos | loja | ocultos
  const vista: Vista = searchParams.vista === 'quadro' ? 'quadro' : 'grade'

  /** Monta a URL da tela preservando o filtro atual, com overrides pontuais. */
  const qs = (overrides: Record<string, string>) => {
    const atuais: Record<string, string> = {
      ...(cat && { cat }),
      ...(q && { q }),
      ...(estado !== 'todos' && { estado }),
      ...(vista !== 'grade' && { vista }),
      ...(page !== 1 && { page: String(page) }),
    }
    const params = new URLSearchParams({ ...atuais, ...overrides })
    // Overrides "neutros" (voltar ao padrão) não devem aparecer na URL
    if (params.get('estado') === 'todos') params.delete('estado')
    if (params.get('vista') === 'grade') params.delete('vista')
    if (params.get('page') === '1') params.delete('page')
    return `/admin/curadoria?${params.toString()}`
  }

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

  const temRecorte = !!(cat || q)

  // A tipagem explícita evita que o TS estreite `take` para o literal 120 ou 60.
  const paginacao: { skip?: number; take: number } =
    vista === 'quadro'
      ? { take: LIMITE_QUADRO }
      : { skip: (page - 1) * POR_PAGINA, take: POR_PAGINA }

  const [produtos, total] = temRecorte
    ? await Promise.all([
        prisma.product.findMany({
          where,
          select: {
            id: true, nome: true, categoria: true, preco: true, imagens: true,
            ativo: true, estoque: true, temImagem: true, fornecedor: true,
            mantidoManual: true, ocultoManual: true,
          },
          orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
          ...paginacao,
        }),
        prisma.product.count({ where }),
      ])
    : [[], 0]

  const pages = Math.ceil(total / POR_PAGINA)
  const excedente = vista === 'quadro' && total > LIMITE_QUADRO ? total - LIMITE_QUADRO : 0

  // Um produto está "na loja" se ativo; Eurolaqui só se mantidoManual
  const estaNaLoja = (p: (typeof produtos)[number]) =>
    p.ativo && !p.ocultoManual && (p.fornecedor !== 'eurolaqui' || p.mantidoManual)

  const itensQuadro: ProdutoKanban[] = produtos.map((p) => {
    const imagens = Array.isArray(p.imagens) ? (p.imagens as unknown[]) : []
    return {
      id: p.id,
      coluna: colunaDoProduto(p),
      rotulo: p.nome,
      nome: p.nome,
      categoria: p.categoria,
      preco: Number(p.preco),
      estoque: p.estoque,
      imagem: typeof imagens[0] === 'string' ? (imagens[0] as string) : null,
      fornecedor: p.fornecedor,
      semImagem: !p.temImagem,
      semEstoque: p.estoque <= 0 && p.fornecedor !== 'eurolaqui',
    }
  })

  return (
    <div>
      <PageHeader
        titulo="Curadoria"
        descricao='No quadro, arraste um produto entre "Na loja" e "Oculto" para decidir o que aparece na vitrine. Produtos sem foto, ou sem estoque e fora da Eurolaqui, ficam bloqueados e não entram na loja.'
        acoes={<AlternadorVista vista={vista} qs={qs} />}
      />

      {/* Categorias */}
      <div className="mb-6">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-dim">
          Categorias
        </p>
        <div className="flex flex-wrap gap-2">
          {categorias.map((c) => (
            <FilterChip
              key={c.nome}
              href={qs({ cat: c.nome, page: '1' })}
              ativo={cat === c.nome}
              contagem={c.total}
            >
              {c.nome}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Busca + filtro de estado */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex min-w-[240px] flex-1 gap-2" action="/admin/curadoria">
          {cat && <input type="hidden" name="cat" value={cat} />}
          {estado !== 'todos' && <input type="hidden" name="estado" value={estado} />}
          {vista !== 'grade' && <input type="hidden" name="vista" value={vista} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome…"
            className="min-w-[200px] flex-1 rounded-xl border border-brand-border bg-brand-surface-2 px-4 py-2.5 text-sm text-brand-text outline-none focus:border-brand-accent"
          />
          <Botao type="submit">Buscar</Botao>
        </form>
        <div className="flex flex-wrap gap-2">
          {(['todos', 'loja', 'ocultos'] as const).map((e) => (
            <FilterChip key={e} href={qs({ estado: e, page: '1' })} ativo={estado === e}>
              {e === 'todos' ? 'Todos' : e === 'loja' ? 'Na loja' : 'Ocultos'}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      {!temRecorte ? (
        <EmptyState
          titulo="Selecione um recorte"
          descricao="Escolha uma categoria acima ou busque por nome para começar a curar."
        />
      ) : produtos.length === 0 ? (
        <EmptyState
          icone={PackageX}
          titulo="Nada encontrado"
          descricao="Nenhum produto corresponde a esse filtro."
        />
      ) : vista === 'quadro' ? (
        <>
          {excedente > 0 && (
            <p className="mb-4 rounded-xl bg-brand-warning-soft px-4 py-2.5 text-xs font-semibold text-brand-warning">
              Mostrando os primeiros {LIMITE_QUADRO} de {total} produtos deste filtro — {excedente}{' '}
              {excedente === 1 ? 'ficou' : 'ficaram'} de fora. Refine a categoria ou a busca para
              ver o restante.
            </p>
          )}
          <CuradoriaKanban produtos={itensQuadro} />
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-brand-muted">
              {total} produto{total !== 1 ? 's' : ''}
            </p>
            <CuradoriaBulkActions cat={cat} q={q} estado={estado} total={total} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {produtos.map((p) => {
              const imagens = Array.isArray(p.imagens) ? (p.imagens as unknown[]) : []
              const img = typeof imagens[0] === 'string' ? (imagens[0] as string) : null
              const naLoja = estaNaLoja(p)
              return (
                <Card
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 p-3',
                    naLoja && 'border-brand-success',
                  )}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-brand-hair bg-brand-surface-2">
                    {img && (
                      <Image src={img} alt="" fill sizes="56px" className="object-contain p-1" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-tight text-brand-text">
                      {p.nome}
                    </p>
                    <p className="mt-0.5 text-[11px] text-brand-muted">
                      {formatPrice(Number(p.preco))}
                      {p.fornecedor === 'eurolaqui' && (
                        <span className="text-brand-warning"> · Eurolaqui</span>
                      )}
                      {!p.temImagem && <span className="text-brand-warning"> · sem foto</span>}
                    </p>
                  </div>
                  <CuradoriaToggle produtoId={p.id} inicial={naLoja} />
                </Card>
              )
            })}
          </div>

          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              {page > 1 && (
                <Link
                  href={qs({ page: String(page - 1) })}
                  className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 text-brand-muted hover:text-brand-text"
                >
                  ← Anterior
                </Link>
              )}
              <span className="text-brand-muted">
                Página {page} de {pages}
              </span>
              {page < pages && (
                <Link
                  href={qs({ page: String(page + 1) })}
                  className="rounded-lg border border-brand-border bg-brand-surface-2 px-3 py-1.5 text-brand-muted hover:text-brand-text"
                >
                  Próxima →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
