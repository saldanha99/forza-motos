/**
 * Medida de pneu — parsing, normalização e formatação.
 *
 * O catálogo do Olist mistura todas as grafias possíveis da mesma medida:
 * "150/60-17", "150/60 R17", "150/60ZR17", "150/60 17"… Buscar por texto
 * (contains) faz o cliente perder o produto por causa de um hífen.
 *
 * A solução é guardar a medida decomposta em 3 inteiros no Product
 * (medidaLargura / medidaPerfil / medidaAro) e buscar por eles. Este módulo é
 * a única fonte de verdade de como o nome do produto vira esses três números.
 */

export interface MedidaPneu {
  /** Primeira medida: 150 em "150/60-17" (mm) */
  largura: number
  /** Segunda medida — o perfil/altura: 60 em "150/60-17" (% da largura) */
  perfil: number
  /** Polegada do aro: 17 em "150/60-17" */
  aro: number
}

/**
 * Faixas plausíveis — evitam que códigos soltos no nome do produto
 * ("Kit 428/120 18 elos") virem medida de pneu.
 */
const LARGURA_MIN = 60
const LARGURA_MAX = 360
const PERFIL_MIN = 20
const PERFIL_MAX = 100
const ARO_MIN = 10
const ARO_MAX = 23

/**
 * Aceita as grafias reais do catálogo:
 * "100/90-18" · "150/70R18" · "100/90 - 19" · "180/55 ZR17" · "120/70 17"
 */
const REGEX_MEDIDA = /(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:[-–]\s*)?(?:Z?R|B)?\s*[-–]?\s*(\d{2})(?!\d)/gi

/** Extrai a PRIMEIRA medida válida de um texto (nome do produto). */
export function parseMedida(texto: string): MedidaPneu | null {
  return parseMedidas(texto)[0] ?? null
}

/**
 * Extrai TODAS as medidas válidas de um texto. Um nome pode trazer o par
 * ("Par Pirelli 120/70-17 + 180/55-17") — a primeira é a principal.
 */
export function parseMedidas(texto: string): MedidaPneu[] {
  const achadas: MedidaPneu[] = []
  const vistas: Record<string, true> = {}
  // regex é global — instância local para não carregar lastIndex entre chamadas
  const re = new RegExp(REGEX_MEDIDA.source, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    const largura = Number(m[1])
    const perfil = Number(m[2])
    const aro = Number(m[3])
    if (largura < LARGURA_MIN || largura > LARGURA_MAX) continue
    if (perfil < PERFIL_MIN || perfil > PERFIL_MAX) continue
    if (aro < ARO_MIN || aro > ARO_MAX) continue
    const chave = `${largura}/${perfil}-${aro}`
    if (vistas[chave]) continue
    vistas[chave] = true
    achadas.push({ largura, perfil, aro })
  }
  return achadas
}

/** Forma canônica de exibição: "150/60-17" */
export function formatarMedida(m: MedidaPneu): string {
  return `${m.largura}/${m.perfil}-${m.aro}`
}

/**
 * Interpreta o que o cliente digitou na busca livre.
 * Aceita "150/60 17", "150-60-17", "150/60R17", "150 60 17".
 * Usado para converter uma busca textual em filtro por colunas.
 */
export function parseMedidaDigitada(input: string): MedidaPneu | null {
  const direto = parseMedida(input)
  if (direto) return direto
  // "150 60 17" / "150-60-17" — sem barra nenhuma
  const m = input.match(/\b(\d{2,3})[\s-](\d{2,3})[\s-](\d{2})\b/)
  if (!m) return null
  const [, largura, perfil, aro] = m.map(Number)
  if (largura < LARGURA_MIN || largura > LARGURA_MAX) return null
  if (perfil < PERFIL_MIN || perfil > PERFIL_MAX) return null
  if (aro < ARO_MIN || aro > ARO_MAX) return null
  return { largura, perfil, aro }
}

/**
 * Gera as grafias de uma medida como aparecem no catálogo do Olist.
 * Continua útil para casar produtos ainda não normalizados (busca textual
 * de compatibilidade nas páginas de modelo de moto).
 */
export function variantesMedida(medida: string): string[] {
  const m = medida.match(/^(\d{2,3}\/\d{2,3})[-\sRZB]*(\d{2})$/i)
  if (!m) return [medida]
  const [, base, aro] = m
  return [
    `${base}-${aro}`,
    `${base}R${aro}`,
    `${base}ZR${aro}`,
    `${base}B${aro}`,
    `${base} R${aro}`,
    `${base} ZR${aro}`,
    `${base} ${aro}`,
  ]
}

/** Índice do funil: largura → perfil → aros disponíveis (com contagem) */
export type IndiceMedidas = Map<number, Map<number, { aro: number; qtd: number }[]>>

export function montarIndice(
  linhas: { medidaLargura: number | null; medidaPerfil: number | null; medidaAro: number | null; _count?: number }[],
): IndiceMedidas {
  const idx: IndiceMedidas = new Map()
  for (const l of linhas) {
    if (l.medidaLargura == null || l.medidaPerfil == null || l.medidaAro == null) continue
    if (!idx.has(l.medidaLargura)) idx.set(l.medidaLargura, new Map())
    const porPerfil = idx.get(l.medidaLargura)!
    if (!porPerfil.has(l.medidaPerfil)) porPerfil.set(l.medidaPerfil, [])
    const aros = porPerfil.get(l.medidaPerfil)!
    const existente = aros.find((a) => a.aro === l.medidaAro)
    if (existente) existente.qtd += l._count ?? 1
    else aros.push({ aro: l.medidaAro, qtd: l._count ?? 1 })
  }
  // Ordena tudo numericamente para o funil sair na ordem natural
  const ordenado: IndiceMedidas = new Map()
  const larguras = Array.from(idx.entries()).sort((a, b) => a[0] - b[0])
  for (const [largura, porPerfil] of larguras) {
    const perfis = Array.from(porPerfil.entries()).sort((a, b) => a[0] - b[0])
    const mapaPerfis = new Map<number, { aro: number; qtd: number }[]>()
    for (const [perfil, aros] of perfis) {
      mapaPerfis.set(perfil, aros.slice().sort((a, b) => a.aro - b.aro))
    }
    ordenado.set(largura, mapaPerfis)
  }
  return ordenado
}

/** Produtos que entram no funil: pneu, à venda, com preço real */
export const WHERE_PNEUS_A_VENDA = {
  ativo: true,
  estoque: { gt: 0 },
  preco: { gt: 0, not: 999 },
  variacaoDe: null,
  OR: [
    { categoria: { contains: 'pneu', mode: 'insensitive' as const } },
    { nome: { contains: 'pneu', mode: 'insensitive' as const } },
  ],
}

/** Serializa o índice para o client component (Map não atravessa o boundary) */
export type IndiceMedidasJSON = [number, [number, { aro: number; qtd: number }[]][]][]

export function serializarIndice(idx: IndiceMedidas): IndiceMedidasJSON {
  return Array.from(idx.entries()).map(([largura, porPerfil]) => [
    largura,
    Array.from(porPerfil.entries()),
  ])
}
