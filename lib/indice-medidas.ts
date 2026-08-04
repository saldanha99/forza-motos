/**
 * Índice de medidas para o funil de busca (largura → altura → aro).
 * Server-only: consulta o banco. Usado pela home e pela página de pneus.
 */
import { prisma } from '@/lib/prisma'
import {
  montarIndice,
  serializarIndice,
  parseMedida,
  WHERE_PNEUS_A_VENDA,
  type IndiceMedidasJSON,
} from '@/lib/medida-pneu'

export async function getIndiceMedidas(): Promise<IndiceMedidasJSON> {
  const grupos = await prisma.product.groupBy({
    by: ['medidaLargura', 'medidaPerfil', 'medidaAro'],
    where: { ...WHERE_PNEUS_A_VENDA, medidaLargura: { not: null } },
    _count: { _all: true },
  })

  let linhas = grupos.map((g) => ({
    medidaLargura: g.medidaLargura,
    medidaPerfil: g.medidaPerfil,
    medidaAro: g.medidaAro,
    _count: g._count._all,
  }))

  // Rede de segurança: enquanto o backfill das medidas não rodar, as colunas
  // estão nulas — deriva o índice dos nomes para o funil não sumir do site.
  if (linhas.length === 0) {
    const nomes = await prisma.product.findMany({
      where: WHERE_PNEUS_A_VENDA,
      select: { nome: true },
    })
    linhas = nomes
      .map(({ nome }) => parseMedida(nome))
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .map((m) => ({
        medidaLargura: m.largura,
        medidaPerfil: m.perfil,
        medidaAro: m.aro,
        _count: 1,
      }))
  }

  return serializarIndice(montarIndice(linhas))
}
