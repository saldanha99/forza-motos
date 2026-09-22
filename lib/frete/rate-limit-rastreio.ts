import { createHash } from 'node:crypto'
import { origemDaRequisicao } from '@/lib/ip-cliente'
import { prisma } from '@/lib/prisma'

const PREFIXO = 'rate_limit:rastreio:'
const JANELA_MS = 60_000
const MAX_TENTATIVAS = 10

type Estado = { inicio: number; tentativas: number }

/** Limite persistente por IP para impedir tentativa automatizada de CPF/e-mail. */
export async function consumirRateLimitRastreio(req: Request): Promise<boolean> {
  const agora = Date.now()
  const origem = origemDaRequisicao(req)
  const chave = `${PREFIXO}${createHash('sha256').update(origem).digest('hex')}`
  const inicial = JSON.stringify({ inicio: agora, tentativas: 0 } satisfies Estado)

  const permitido = await prisma.$transaction(async (tx) => {
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
      estado = JSON.parse(linhas[0]?.value ?? '') as Estado
      if (!Number.isFinite(estado.inicio) || !Number.isInteger(estado.tentativas)) {
        throw new Error('estado inválido')
      }
    } catch {
      estado = { inicio: agora, tentativas: 0 }
    }

    if (agora - estado.inicio >= JANELA_MS) estado = { inicio: agora, tentativas: 0 }
    if (estado.tentativas >= MAX_TENTATIVAS) return false

    estado.tentativas += 1
    await tx.setting.update({
      where: { key: chave },
      data: { value: JSON.stringify(estado) },
    })
    return true
  })

  if (Math.random() < 0.01) {
    await prisma.setting.deleteMany({
      where: {
        key: { startsWith: PREFIXO },
        updatedAt: { lt: new Date(agora - 24 * 60 * 60_000) },
      },
    }).catch(() => {})
  }

  return permitido
}
