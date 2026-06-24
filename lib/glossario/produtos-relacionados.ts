import { prisma } from '@/lib/prisma'

/**
 * Busca produtos da loja relacionados a um termo do glossário.
 *
 * Como as categorias dos termos do glossário estão vazias, fazemos o match
 * por palavras-chave extraídas do título do termo, mapeando para as categorias
 * reais de produto do catálogo (Pneu, Capacete, Jaqueta, Óleo, etc.).
 *
 * Estratégia em camadas:
 *   1. Detecta o "tema" do termo por keywords conhecidas → categorias-alvo
 *   2. Busca produtos ativos COM imagem que batam por categoria OU nome
 *   3. Fallback: produtos ativos com imagem em destaque (promoção primeiro)
 *
 * Sempre retorna produtos vendáveis (ativo + com imagem + com estoque).
 */

export interface ProdutoRelacionado {
  id: string
  nome: string
  slug: string
  preco: number
  precoPromocional: number | null
  imagens: string[]
  estoque: number
  marca: string
  categoria: string
}

/** Stopwords PT-BR + ruído comum nos títulos do glossário ("O que é ...") */
const STOPWORDS = new Set([
  'o', 'a', 'os', 'as', 'um', 'uma', 'que', 'e', 'de', 'do', 'da', 'dos', 'das',
  'para', 'por', 'com', 'sem', 'em', 'no', 'na', 'nos', 'nas', 'ao', 'aos',
  'qual', 'quais', 'como', 'quando', 'onde', 'porque', 'significa', 'serve',
  'sao', 'são', 'é', 'ser', 'seu', 'sua', 'tipos', 'tipo', 'sobre', 'entre',
  'mais', 'menos', 'moto', 'motos', 'motocicleta', 'pilotagem', 'pilotar',
])

/**
 * Mapa tema → categorias/keywords de produto.
 * A chave é uma keyword que pode aparecer no termo; o valor são fragmentos
 * que casam com `categoria` ou `nome` do produto (case-insensitive).
 */
const TEMA_PARA_ALVOS: Record<string, string[]> = {
  pneu: ['pneu'],
  radial: ['pneu'],
  aro: ['pneu'],
  banda: ['pneu'],
  camara: ['pneu'],
  capacete: ['capacete'],
  viseira: ['capacete'],
  jaqueta: ['jaqueta'],
  protetor: ['jaqueta', 'protetor'],
  protecao: ['jaqueta', 'capacete', 'luva', 'protetor'],
  proteção: ['jaqueta', 'capacete', 'luva', 'protetor'],
  seguranca: ['capacete', 'jaqueta', 'luva'],
  segurança: ['capacete', 'jaqueta', 'luva'],
  acessorio: ['capacete', 'jaqueta', 'luva', 'acessor'],
  acessório: ['capacete', 'jaqueta', 'luva', 'acessor'],
  equipamento: ['capacete', 'jaqueta', 'luva'],
  epi: ['capacete', 'jaqueta', 'luva'],
  luva: ['luva'],
  bota: ['bota', 'calçado'],
  macacao: ['macacao'],
  calca: ['calça'],
  calça: ['calça'],
  oleo: ['óleo', 'oleo', 'lubrific'],
  óleo: ['óleo', 'oleo', 'lubrific'],
  lubrificante: ['óleo', 'oleo', 'lubrific'],
  viscosidade: ['óleo', 'oleo'],
  freio: ['freio', 'pastilha', 'disco'],
  pastilha: ['pastilha', 'freio'],
  disco: ['disco', 'freio'],
  corrente: ['corrente', 'transmiss', 'kit relação', 'coroa', 'pinhao'],
  transmissao: ['transmiss', 'corrente', 'coroa', 'pinhao'],
  transmissão: ['transmiss', 'corrente', 'coroa', 'pinhao'],
  relacao: ['transmiss', 'corrente', 'coroa', 'pinhao'],
  amortecedor: ['amortecedor', 'suspens'],
  suspensao: ['amortecedor', 'suspens'],
  suspensão: ['amortecedor', 'suspens'],
}

/** Extrai tokens significativos do termo (sem acento, sem stopword, 3+ chars) */
function tokenizar(termo: string): string[] {
  return termo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/** Resolve os fragmentos-alvo (categoria/nome) a partir das keywords do termo */
function resolverAlvos(termo: string): string[] {
  const tokens = tokenizar(termo)
  const alvos = new Set<string>()

  for (const tk of tokens) {
    // Match direto no mapa de temas (com e sem acento já normalizado nas chaves)
    for (const [chave, valores] of Object.entries(TEMA_PARA_ALVOS)) {
      const chaveNorm = chave.normalize('NFD').replace(/[̀-ͯ]/g, '')
      if (tk === chaveNorm || tk.startsWith(chaveNorm) || chaveNorm.startsWith(tk)) {
        valores.forEach((v) => alvos.add(v))
      }
    }
  }

  return Array.from(alvos)
}

/**
 * Retorna até `limit` produtos relacionados ao termo, prontos para exibição.
 */
export async function produtosRelacionadosAoTermo(
  termo: string,
  limit = 8,
): Promise<ProdutoRelacionado[]> {
  const alvos = resolverAlvos(termo)

  const baseWhere = {
    ativo: true,
    temImagem: true,
    estoque: { gt: 0 },
    preco: { gt: 0, not: 999 },
  } as const

  const select = {
    id: true,
    nome: true,
    slug: true,
    preco: true,
    precoPromocional: true,
    imagens: true,
    estoque: true,
    marca: true,
    categoria: true,
  }

  let produtos: any[] = []

  if (alvos.length > 0) {
    produtos = await prisma.product.findMany({
      where: {
        ...baseWhere,
        OR: alvos.flatMap((alvo) => [
          { categoria: { contains: alvo, mode: 'insensitive' as const } },
          { nome: { contains: alvo, mode: 'insensitive' as const } },
        ]),
      },
      select,
      // Promoção primeiro, depois mais recentes
      orderBy: [{ precoPromocional: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
    })
  }

  // Fallback: se não houve match suficiente, completa com destaques da loja
  if (produtos.length < Math.min(4, limit)) {
    const idsJaPegos = produtos.map((p) => p.id)
    const extras = await prisma.product.findMany({
      where: {
        ...baseWhere,
        id: { notIn: idsJaPegos.length ? idsJaPegos : ['__none__'] },
      },
      select,
      orderBy: [{ precoPromocional: 'desc' }, { updatedAt: 'desc' }],
      take: limit - produtos.length,
    })
    produtos = [...produtos, ...extras]
  }

  return produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    slug: p.slug,
    preco: Number(p.preco),
    precoPromocional: p.precoPromocional != null ? Number(p.precoPromocional) : null,
    imagens: Array.isArray(p.imagens) ? (p.imagens as string[]) : [],
    estoque: p.estoque,
    marca: p.marca ?? '',
    categoria: p.categoria ?? '',
  }))
}
