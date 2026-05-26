import { criarJobEmMassa } from './queries'

/**
 * Importa um CSV de termos para a fila de geração.
 *
 * Formato esperado do CSV (header obrigatório):
 *   titulo,letra,categoria
 *   "Pneu Radial","P","Pneus"
 *   "Pneu Diagonal","P","Pneus"
 *   "Óleo Mineral","O","Óleos"
 *
 * A coluna "letra" e "categoria" são opcionais — se ausente, a letra é
 * derivada automaticamente do título.
 */

export interface CsvRow {
  titulo: string
  letra?: string
  categoria?: string
}

export function parseCSV(csv: string): CsvRow[] {
  const linhas = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  if (linhas.length < 2) return []

  const header = parseLinhaCSV(linhas[0]).map((h) => h.toLowerCase().trim())
  const idxTitulo = header.indexOf('titulo')
  const idxLetra = header.indexOf('letra')
  const idxCategoria = header.indexOf('categoria')

  if (idxTitulo === -1) {
    throw new Error('CSV inválido: coluna "titulo" é obrigatória no cabeçalho')
  }

  const rows: CsvRow[] = []
  for (let i = 1; i < linhas.length; i++) {
    const campos = parseLinhaCSV(linhas[i])
    const titulo = campos[idxTitulo]?.trim()
    if (!titulo) continue
    rows.push({
      titulo,
      letra: idxLetra >= 0 ? campos[idxLetra]?.trim() : undefined,
      categoria: idxCategoria >= 0 ? campos[idxCategoria]?.trim() : undefined,
    })
  }

  // Deduplica por título
  const vistos = new Set<string>()
  return rows.filter((r) => {
    const k = r.titulo.toLowerCase()
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

/** Parser simples que respeita aspas e vírgulas dentro de campos */
function parseLinhaCSV(linha: string): string[] {
  const result: string[] = []
  let atual = ''
  let dentroAspas = false

  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]
    if (c === '"') {
      // Aspa dupla escapada
      if (dentroAspas && linha[i + 1] === '"') {
        atual += '"'
        i++
      } else {
        dentroAspas = !dentroAspas
      }
    } else if (c === ',' && !dentroAspas) {
      result.push(atual)
      atual = ''
    } else {
      atual += c
    }
  }
  result.push(atual)
  return result
}

export async function importarCSVParaFila(
  csv: string,
  opcoes: Parameters<typeof criarJobEmMassa>[1]
) {
  const rows = parseCSV(csv)
  if (rows.length === 0) {
    throw new Error('CSV não contém linhas válidas')
  }
  return criarJobEmMassa(rows, opcoes)
}
