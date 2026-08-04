/**
 * Pré-preenche a tabela Moto com as medidas de fábrica de data/medidas-motos.json.
 *
 * Tudo entra com medidasConferidas=false: o Caio revisa no admin
 * (/admin/motos) e só então as medidas passam a alimentar a busca por placa.
 * Nunca sobrescreve o que a loja já conferiu.
 *
 * Uso:  npx tsx scripts/seed-medidas-motos.ts        (aplica)
 *       npx tsx scripts/seed-medidas-motos.ts --dry  (simula)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { gerarSlugMoto } from '../lib/moto'
import { parseMedida, formatarMedidaNeutra } from '../lib/medida-pneu'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry')

interface Linha {
  marca: string
  modelo: string
  medidaDianteira: string
  medidaTraseira: string
  fonte: string
}

/** Faixa aberta: vale para qualquer ano até a loja refinar as gerações */
const ANO_DE = 1990

/**
 * A medida de fábrica é guardada SEM construção (só os três números).
 * A mesma moto costuma aceitar radial e diagonal — quem escolhe é o cliente
 * na hora de comprar, então o site não fixa um dos dois pela moto.
 */
function medidaNeutra(bruta: string): string | null {
  const m = parseMedida(bruta)
  return m ? formatarMedidaNeutra(m) : null
}

async function main() {
  const arquivo = join(process.cwd(), 'data', 'medidas-motos.json')
  const linhas: Linha[] = JSON.parse(readFileSync(arquivo, 'utf8'))
  console.log(`${linhas.length} motos no arquivo${dryRun ? ' (simulação)' : ''}`)

  let criadas = 0
  let atualizadas = 0
  let preservadas = 0

  for (const l of linhas) {
    const slug = gerarSlugMoto(l.marca, l.modelo, ANO_DE, null)
    const existente = await prisma.moto.findUnique({ where: { slug } })

    // Medida já conferida pela loja é a verdade — nunca sobrescrever
    if (existente?.medidasConferidas) {
      preservadas++
      continue
    }

    const dianteira = medidaNeutra(l.medidaDianteira)
    const traseira = medidaNeutra(l.medidaTraseira)

    if (!dryRun) {
      await prisma.moto.upsert({
        where: { slug },
        create: {
          marca: l.marca,
          modelo: l.modelo,
          anoDe: ANO_DE,
          anoAte: null,
          slug,
          medidaDianteira: dianteira,
          medidaTraseira: traseira,
          medidasConferidas: false,
          fonteMedidas: l.fonte,
        },
        update: {
          medidaDianteira: dianteira,
          medidaTraseira: traseira,
          fonteMedidas: l.fonte,
        },
      })
    }
    if (existente) atualizadas++
    else criadas++
  }

  console.log(`\ncriadas: ${criadas} · atualizadas: ${atualizadas} · preservadas (já conferidas): ${preservadas}`)

  if (!dryRun) {
    const total = await prisma.moto.count()
    const conferidas = await prisma.moto.count({ where: { medidasConferidas: true } })
    console.log(`Motos no banco: ${total} · conferidas pela loja: ${conferidas}`)
    console.log('→ Revise em /admin/motos: só as conferidas aparecem na busca por placa.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
