/**
 * Motos e peças compatíveis por faixa de ano.
 * Uma moto com faixas de ano diferentes (ex.: GS 1200 até 2012, 2013–2018, 2019+)
 * vira registros distintos de Moto.
 */
import { prisma } from '@/lib/prisma'
import { gerarSlug } from '@/lib/utils'

/** Rótulo legível da faixa de ano: "2013–2018", "2019 em diante", "até 2012" */
export function faixaAnoLabel(anoDe: number, anoAte: number | null): string {
  if (!anoAte) return `${anoDe} em diante`
  if (anoDe === anoAte) return `${anoDe}`
  return `${anoDe}–${anoAte}`
}

/** Nome completo: "Honda CG 160 (2016–2022)" */
export function motoNomeCompleto(m: { marca: string; modelo: string; anoDe: number; anoAte: number | null }): string {
  return `${m.marca} ${m.modelo} (${faixaAnoLabel(m.anoDe, m.anoAte)})`
}

/** Slug único: "honda-cg-160-2016-2022" / "bmw-r-1200-gs-2019-em-diante" */
export function gerarSlugMoto(marca: string, modelo: string, anoDe: number, anoAte: number | null): string {
  const faixa = anoAte ? `${anoDe}-${anoAte}` : `${anoDe}-em-diante`
  return gerarSlug(`${marca} ${modelo} ${faixa}`)
}

/**
 * Casa uma moto do catálogo pela marca+modelo (busca aproximada) e ano dentro
 * da faixa. Usado pela busca por placa (que retorna marca, modelo e ano).
 * Retorna a moto cuja faixa contém o ano; se houver várias, a de faixa mais estreita.
 */
export async function casarMotoPorPlaca(
  marca: string,
  modelo: string,
  ano: number | null,
): Promise<{ slug: string; marca: string; modelo: string; anoDe: number; anoAte: number | null } | null> {
  const alvo = `${marca} ${modelo}`.toUpperCase()
  const candidatas = await prisma.moto.findMany({
    select: { slug: true, marca: true, modelo: true, anoDe: true, anoAte: true },
  })

  const compatíveis = candidatas.filter((m) => {
    const nome = `${m.marca} ${m.modelo}`.toUpperCase()
    // marca+modelo do catálogo aparece no retorno da placa (ou vice-versa)
    const casaNome = alvo.includes(m.modelo.toUpperCase()) && alvo.includes(m.marca.toUpperCase())
    if (!casaNome) return false
    if (ano == null) return true
    const dentroFaixa = ano >= m.anoDe && (m.anoAte == null || ano <= m.anoAte)
    return dentroFaixa
  })

  if (compatíveis.length === 0) return null
  // Faixa mais estreita primeiro (mais específica)
  compatíveis.sort((a, b) => {
    const la = (a.anoAte ?? 9999) - a.anoDe
    const lb = (b.anoAte ?? 9999) - b.anoDe
    return la - lb
  })
  return compatíveis[0]
}
