/**
 * Segmentos de pneu (Custom, Big Trail, Esportivo/Street, Scooter) e as linhas
 * dentro de cada um — a navegação de /pneus.
 *
 * A classificação vive no banco e é feita pelo admin: o Olist manda a categoria
 * como "Pneus" ou "Pneu >> <marca>", que não diz nada sobre uso da moto. Por
 * isso o sync não encosta em `pneuSegmentoId` nem em `pneuLinha`.
 */
import { prisma } from '@/lib/prisma'

export interface SegmentoPneu {
  id: string
  nome: string
  slug: string
  descricao: string | null
  imagemUrl: string | null
  /** Quantos produtos publicados o segmento tem hoje */
  produtos: number
}

export interface LinhaPneu {
  /** Rótulo como o admin escreveu (ex.: "Angel GT") */
  nome: string
  slug: string
  produtos: number
}

/** Slug estável a partir do nome da linha — é o que vai para a URL. */
export function slugLinha(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Só conta o que o cliente realmente vê na vitrine. */
const PRODUTO_PUBLICADO = {
  ativo: true,
  temImagem: true,
  ocultoManual: false,
  eventoPirelliId: null,
} as const

/**
 * Segmentos ativos, na ordem definida pelo admin, com a contagem de produtos.
 * Nunca lança: com o banco fora a vitrine cai na listagem antiga de pneus.
 */
export async function listarSegmentos(incluirVazios = false): Promise<SegmentoPneu[]> {
  try {
    const segmentos = await prisma.pneuSegmento.findMany({
      where: { ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        nome: true,
        slug: true,
        descricao: true,
        imagemUrl: true,
        _count: { select: { produtos: { where: PRODUTO_PUBLICADO } } },
      },
    })

    return segmentos
      .map(({ _count, ...s }) => ({ ...s, produtos: _count.produtos }))
      .filter((s) => incluirVazios || s.produtos > 0)
  } catch (e) {
    console.warn('[pneus] segmentos indisponíveis:', (e as Error)?.message)
    return []
  }
}

/** Um segmento pelo slug (sem filtrar por produtos) — null se não existir. */
export async function getSegmento(slug: string) {
  try {
    return await prisma.pneuSegmento.findFirst({ where: { slug, ativo: true } })
  } catch {
    return null
  }
}

/**
 * Linhas de pneu dentro de um segmento, agrupadas pelo rótulo do admin.
 * Produtos sem linha preenchida não somem da loja — eles caem em "Outros
 * modelos" na página do segmento.
 */
export async function listarLinhas(segmentoId: string): Promise<LinhaPneu[]> {
  try {
    const grupos = await prisma.product.groupBy({
      by: ['pneuLinha'],
      where: { ...PRODUTO_PUBLICADO, pneuSegmentoId: segmentoId },
      _count: { _all: true },
    })

    return grupos
      .filter((g): g is typeof g & { pneuLinha: string } => Boolean(g.pneuLinha?.trim()))
      .map((g) => ({
        nome: g.pneuLinha.trim(),
        slug: slugLinha(g.pneuLinha),
        produtos: g._count._all,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  } catch (e) {
    console.warn('[pneus] linhas indisponíveis:', (e as Error)?.message)
    return []
  }
}

/** Filtro de produtos de um segmento, opcionalmente restrito a uma linha. */
export function filtroProdutosDoSegmento(segmentoId: string, linhaNome?: string) {
  return {
    ...PRODUTO_PUBLICADO,
    pneuSegmentoId: segmentoId,
    ...(linhaNome ? { pneuLinha: linhaNome } : {}),
  }
}

/**
 * Resolve o slug de linha de volta para o rótulo salvo. A URL carrega o slug,
 * mas o banco guarda o texto do admin — comparar por slug evita depender de
 * acento e caixa exatos.
 */
export async function acharLinhaPeloSlug(
  segmentoId: string,
  linhaSlug: string,
): Promise<LinhaPneu | null> {
  const linhas = await listarLinhas(segmentoId)
  return linhas.find((l) => l.slug === linhaSlug) ?? null
}
