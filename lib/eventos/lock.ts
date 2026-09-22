import type { Prisma } from '@prisma/client'

/**
 * Serializa reserva, confirmação e expiração das vagas de um evento.
 *
 * `pg_advisory_xact_lock` retorna `void`; selecionar essa função diretamente
 * faz o Prisma tentar desserializar um tipo sem representação e lançar P2010.
 * A coluna booleana mantém o mesmo lock transacional com um retorno suportado.
 */
export async function travarCapacidadeEvento(
  tx: Prisma.TransactionClient,
  eventoId: string,
): Promise<void> {
  await tx.$queryRaw<Array<{ locked: boolean }>>`
    SELECT true AS locked
    FROM pg_advisory_xact_lock(hashtext(${`evento:${eventoId}`}))
  `
}
