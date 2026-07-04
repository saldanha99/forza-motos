/**
 * Consulta de placa → veículo, via API Placas (wdapi2.com.br).
 * Cada consulta na API custa crédito — resultados ficam em cache no banco
 * (PlacaConsulta) e a mesma placa nunca é consultada duas vezes.
 */
import { prisma } from '@/lib/prisma'
import { casarModeloPorNome } from '@/lib/motos-modelos'

export interface VeiculoPlaca {
  marca: string
  modelo: string
  ano: string
  cor: string
}

/** Valida e normaliza placa (padrão antigo AAA0000 e Mercosul AAA0A00) */
export function normalizarPlaca(input: string): string | null {
  const placa = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) return placa
  return null
}

async function consultarApiPlacas(placa: string): Promise<VeiculoPlaca | null> {
  const token = process.env.PLACAS_API_TOKEN
  if (!token) throw new Error('PLACAS_API_TOKEN não configurado')

  const res = await fetch(`https://wdapi2.com.br/consulta/${placa}/${token}`, {
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) {
    if (res.status === 404) return null // placa não encontrada
    throw new Error(`API Placas HTTP ${res.status}`)
  }
  const d: any = await res.json()
  if (!d?.MARCA && !d?.marca) return null

  return {
    marca: String(d.MARCA ?? d.marca ?? '').trim(),
    modelo: String(d.MODELO ?? d.modelo ?? '').trim(),
    ano: String(d.anoModelo ?? d.ano ?? '').trim(),
    cor: String(d.cor ?? '').trim(),
  }
}

export async function consultarPlaca(placaRaw: string): Promise<{
  veiculo: VeiculoPlaca
  /** Slug em /pneus/[slug] quando o modelo está no nosso catálogo de motos */
  modeloSlug: string | null
  /** Termo de busca para /produtos quando não há página dedicada */
  termoBusca: string | null
} | null> {
  const placa = normalizarPlaca(placaRaw)
  if (!placa) return null

  // 1. Cache (nunca expira — dados de veículo não mudam)
  let veiculo: VeiculoPlaca | null = null
  const cache = await prisma.placaConsulta.findUnique({ where: { placa } })
  if (cache) {
    veiculo = cache.resposta as unknown as VeiculoPlaca
  } else {
    veiculo = await consultarApiPlacas(placa)
    if (veiculo) {
      await prisma.placaConsulta
        .create({ data: { placa, resposta: veiculo as any } })
        .catch(() => {})
    }
  }
  if (!veiculo) return null

  // 2. Casa com o catálogo de modelos (página dedicada de pneus)
  const marcaModelo = `${veiculo.marca} ${veiculo.modelo}`
  const modelo = casarModeloPorNome(marcaModelo)

  // 3. Fallback: extrai o "nome de família" do modelo p/ busca genérica
  //    Ex.: "CG 160 TITAN S" → "CG 160" · "FAZER YS250" → "FAZER"
  let termoBusca: string | null = null
  const m = veiculo.modelo.toUpperCase().match(/([A-Z]{2,6})\s?-?\s?(\d{2,4})/)
  if (m) termoBusca = `${m[1]} ${m[2]}`.trim()
  else termoBusca = veiculo.modelo.split(/[\s/]/)[0] || null

  return {
    veiculo,
    modeloSlug: modelo?.slug ?? null,
    termoBusca: modelo?.termosCompativeis[0] ?? termoBusca,
  }
}
