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
): Promise<{
  slug: string
  marca: string
  modelo: string
  anoDe: number
  anoAte: number | null
  medidaDianteira: string | null
  medidaTraseira: string | null
  medidasConferidas: boolean
} | null> {
  // O Denatran escreve "R1200 GS"; o cadastro, "R 1200 GS". Comparar sem
  // espaços/pontuação faz as duas grafias baterem.
  const compactar = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const alvo = compactar(`${marca} ${modelo}`)
  const candidatas = await prisma.moto.findMany({
    select: {
      slug: true, marca: true, modelo: true, anoDe: true, anoAte: true,
      medidaDianteira: true, medidaTraseira: true, medidasConferidas: true,
    },
  })

  const compatíveis = candidatas.filter((m) => {
    // O cadastro precisa estar CONTIDO no retorno da placa — nunca o contrário,
    // senão uma "R 1200 GS" casaria com o cadastro "R 1200 GS Adventure".
    const casaNome =
      alvo.includes(compactar(m.modelo)) && alvo.includes(compactar(m.marca))
    if (!casaNome) return false
    if (ano == null) return true
    const dentroFaixa = ano >= m.anoDe && (m.anoAte == null || ano <= m.anoAte)
    return dentroFaixa
  })

  if (compatíveis.length === 0) return null
  // Faixa mais estreita primeiro (mais específica); com medida conferida à
  // frente da genérica quando as faixas empatam
  compatíveis.sort((a, b) => {
    const la = (a.anoAte ?? 9999) - a.anoDe
    const lb = (b.anoAte ?? 9999) - b.anoDe
    if (la !== lb) return la - lb
    return Number(b.medidasConferidas) - Number(a.medidasConferidas)
  })
  return compatíveis[0]
}
