/**
 * Categorias temporariamente OCULTAS da loja.
 * Os produtos continuam no banco (voltam sozinhos ao remover daqui), mas
 * não aparecem em nenhuma vitrine, busca ou landing enquanto listados.
 *
 * Motivo atual: a Forza não está vendendo capacetes por enquanto (05/07).
 * Para voltar a vender, basta esvaziar este array.
 */
export const CATEGORIAS_OCULTAS = ['capacete']

/**
 * Fragmento Prisma para excluir as categorias ocultas de uma query de Product.
 * Espalhe dentro do `where`:  where: { ativo: true, ...filtroCategoriasOcultas() }
 */
export function filtroCategoriasOcultas() {
  // Sempre esconde produtos ocultados manualmente pelo admin (curadoria),
  // além das categorias globalmente ocultas.
  const and: any[] = [{ ocultoManual: false }]
  for (const termo of CATEGORIAS_OCULTAS) {
    and.push({ NOT: { categoria: { contains: termo, mode: 'insensitive' as const } } })
  }
  return { AND: and }
}

/** True se a categoria informada está oculta (ex: bloquear página do produto) */
export function categoriaOculta(categoria: string | null | undefined): boolean {
  if (!categoria) return false
  const c = categoria.toLowerCase()
  return CATEGORIAS_OCULTAS.some((t) => c.includes(t.toLowerCase()))
}

/** Versão SQL (para $queryRaw): esconde ocultos manuais + categorias ocultas. */
export function sqlCategoriasOcultas(): string {
  let sql = ` AND "ocultoManual" = false`
  for (const t of CATEGORIAS_OCULTAS) sql += ` AND categoria NOT ILIKE '%${t}%'`
  return sql
}
