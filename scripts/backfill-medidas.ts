/**
 * Preenche medidaLargura/medidaPerfil/medidaAro dos produtos já existentes.
 *
 * A sincronização diária passou a gravar esses campos, mas produtos que não
 * mudarem no Olist ficariam sem medida (e sumiriam do funil de busca). Este
 * script varre o catálogo inteiro uma vez.
 *
 * Uso (na VPS, dentro do container):  npx tsx scripts/backfill-medidas.ts
 *      Simular sem gravar:            npx tsx scripts/backfill-medidas.ts --dry
 */
import { PrismaClient } from '@prisma/client'
import { parseMedida, formatarMedida } from '../lib/medida-pneu'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry')

async function main() {
  const produtos = await prisma.product.findMany({
    select: { id: true, nome: true, medidaLargura: true, medidaPerfil: true, medidaAro: true },
  })
  console.log(`${produtos.length} produtos no catálogo${dryRun ? ' (simulação)' : ''}`)

  let gravados = 0
  let limpos = 0
  let inalterados = 0

  for (const p of produtos) {
    const m = parseMedida(p.nome)
    const igual =
      (m?.largura ?? null) === p.medidaLargura &&
      (m?.perfil ?? null) === p.medidaPerfil &&
      (m?.aro ?? null) === p.medidaAro
    if (igual) {
      inalterados++
      continue
    }
    if (!dryRun) {
      await prisma.product.update({
        where: { id: p.id },
        data: {
          medidaLargura: m?.largura ?? null,
          medidaPerfil: m?.perfil ?? null,
          medidaAro: m?.aro ?? null,
        },
      })
    }
    if (m) {
      gravados++
      if (gravados <= 20) console.log(`  ${formatarMedida(m).padEnd(12)} ← ${p.nome}`)
    } else {
      limpos++
    }
  }

  console.log(`\nCom medida: ${gravados} · limpos: ${limpos} · já corretos: ${inalterados}`)

  const comMedida = await prisma.product.count({ where: { medidaLargura: { not: null } } })
  const naLoja = await prisma.product.count({
    where: { medidaLargura: { not: null }, ativo: true, estoque: { gt: 0 } },
  })
  console.log(`Total com medida no banco: ${comMedida} (${naLoja} à venda)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
