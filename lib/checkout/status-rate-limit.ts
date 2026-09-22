import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { origemDaRequisicao } from '@/lib/ip-cliente'

const PREFIXO = 'rate_limit:checkout_status:'
const JANELA_MS = 60_000
const MAX_CONSULTAS = 24

type Estado = { inicio: number; consultas: number }

/** Rate limit persistente por token+origem, compartilhado entre processos. */
export async function consumirRateLimitStatusCheckout(req: Request, token: string) {
  const agora = Date.now()
  const identidade = `${origemDaRequisicao(req)}:${token}`
  const chave = `${PREFIXO}${createHash('sha256').update(identidade).digest('hex')}`
  const inicial = JSON.stringify({ inicio: agora, consultas: 0 } satisfies Estado)

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "Setting" ("key", "value", "updatedAt")
      VALUES (${chave}, ${inicial}, NOW())
      ON CONFLICT ("key") DO NOTHING
    `
    const linhas = await tx.$queryRaw<Array<{ value: string }>>`
      SELECT "value" FROM "Setting" WHERE "key" = ${chave} FOR UPDATE
    `
    let estado: Estado
    try {
      estado = JSON.parse(linhas[0]?.value ?? '')
      if (!Number.isFinite(estado.inicio) || !Number.isInteger(estado.consultas)) throw new Error()
    } catch {
      estado = { inicio: agora, consultas: 0 }
    }
    if (agora - estado.inicio >= JANELA_MS) estado = { inicio: agora, consultas: 0 }
    if (estado.consultas >= MAX_CONSULTAS) return false
    estado.consultas += 1
    await tx.setting.update({ where: { key: chave }, data: { value: JSON.stringify(estado) } })
    return true
  })
}
