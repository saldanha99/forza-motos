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
  /** Rótulo exibido — o mais usado entre as grafias que caem no mesmo slug */
  nome: string
  slug: string
  produtos: number
  /**
   * Todas as grafias que o admin digitou e que resolvem para este slug.
   * "Angel GT", "angel gt" e "Angel  GT" são a mesma linha para o cliente.
   */
  rotulos: string[]
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
 * Linhas de pneu dentro de um segmento.
 *
 * O agrupamento é pelo slug, e não pelo texto cru: o campo é digitado a mão
 * produto a produto, então "Angel GT" e "angel gt" iam virar dois cards que
 * levam ao mesmo link — um deles ficaria inalcançável. Aqui as grafias se
 * juntam e a mais usada vira o rótulo exibido.
 *
 * Produto sem linha preenchida não some da loja: ele continua na listagem do
 * segmento, só não ganha subcategoria.
 */
export async function listarLinhas(segmentoId: string): Promise<LinhaPneu[]> {
  try {
    const grupos = await prisma.product.groupBy({
      by: ['pneuLinha'],
      where: { ...PRODUTO_PUBLICADO, pneuSegmentoId: segmentoId },
      _count: { _all: true },
    })

    const porSlug = new Map<string, { candidatos: Map<string, number>; produtos: number }>()

    for (const grupo of grupos) {
      const rotulo = grupo.pneuLinha?.trim()
      if (!rotulo) continue
      const slug = slugLinha(rotulo)
      if (!slug) continue

      const atual = porSlug.get(slug) ?? { candidatos: new Map<string, number>(), produtos: 0 }
      atual.candidatos.set(rotulo, (atual.candidatos.get(rotulo) ?? 0) + grupo._count._all)
      atual.produtos += grupo._count._all
      porSlug.set(slug, atual)
    }

    return [...porSlug.entries()]
      .map(([slug, { candidatos, produtos }]) => {
        // Desempate por ordem alfabética para o rótulo não dançar entre deploys.
        const rotulos = [...candidatos.entries()]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
          .map(([rotulo]) => rotulo)
        return { nome: rotulos[0], slug, produtos, rotulos }
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  } catch (e) {
    console.warn('[pneus] linhas indisponíveis:', (e as Error)?.message)
    return []
  }
}

/**
 * Filtro de produtos de um segmento, opcionalmente restrito a uma linha.
 * Recebe todas as grafias da linha para não perder produto por diferença de
 * caixa ou espaço na digitação.
 */
export function filtroProdutosDoSegmento(segmentoId: string, rotulosLinha?: string[]) {
  return {
    ...PRODUTO_PUBLICADO,
    pneuSegmentoId: segmentoId,
    ...(rotulosLinha?.length ? { pneuLinha: { in: rotulosLinha } } : {}),
  }
}

/**
 * Resolve o slug da URL de volta para a linha, com todas as grafias que ela
 * juntou. A URL carrega o slug; o banco guarda o texto que o admin digitou.
 */
export async function acharLinhaPeloSlug(
  segmentoId: string,
  linhaSlug: string,
): Promise<LinhaPneu | null> {
  const linhas = await listarLinhas(segmentoId)
  return linhas.find((l) => l.slug === linhaSlug) ?? null
}
