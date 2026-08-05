import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { origemDaRequisicao } from '@/lib/ip-cliente'

export const CRM_LEAD_RATE_LIMIT_PREFIX = 'rate_limit:crm_lead:'
const JANELA_MS = 60_000
const MAX_TENTATIVAS = 5

type EstadoRateLimit = { inicio: number; tentativas: number }

/**
 * Identidade de origem para o rate limit da captação.
 *
 * A implementação vive em `lib/ip-cliente.ts`, compartilhada com agendamento e
 * cadastro do evento. Aqui existia uma cópia — correta, mas cópia — cujo
 * comentário dizia "espelha deliberadamente lib/agendamento/rate-limit.ts".
 * Não espelhava: aquele validava o IP com um regex que aceita `"...."` como
 * endereço, e como cada string vira bucket próprio, bastava rotacionar lixo no
 * cabeçalho para nunca bater no limite. O comentário fez a divergência passar
 * por alinhamento em duas revisões. Com uma fonte só, ela não volta.
 */
export const ipDaCaptura = origemDaRequisicao

/** Hash impede armazenar o IP bruto no banco. */
export function chaveRateLimitCaptura(ip: string) {
  return `${CRM_LEAD_RATE_LIMIT_PREFIX}${createHash('sha256').update(ip).digest('hex')}`
}

/**
 * Rate-limit compartilhado entre processos/serverless. A linha por IP é
 * bloqueada dentro da transação, então duas requisições simultâneas não
 * conseguem consumir o mesmo slot. Falhas do banco bloqueiam a captura no
 * chamador (fail-closed) em vez de liberar abuso.
 */
export async function consumirRateLimitCaptura(req: Request) {
  const agora = Date.now()
  const chave = chaveRateLimitCaptura(ipDaCaptura(req))
  const valorInicial = JSON.stringify({ inicio: agora, tentativas: 0 } satisfies EstadoRateLimit)

  const permitido = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "Setting" ("key", "value", "updatedAt")
      VALUES (${chave}, ${valorInicial}, NOW())
      ON CONFLICT ("key") DO NOTHING
    `

    const linhas = await tx.$queryRaw<Array<{ value: string }>>`
      SELECT "value" FROM "Setting" WHERE "key" = ${chave} FOR UPDATE
    `

    let estado: EstadoRateLimit
    try {
      estado = JSON.parse(linhas[0]?.value ?? '') as EstadoRateLimit
      if (!Number.isFinite(estado.inicio) || !Number.isInteger(estado.tentativas)) throw new Error('estado inválido')
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

  // Limpeza probabilística mantém o caminho público barato e evita crescimento
  // ilimitado por IPs que nunca retornam. A folga de um dia não disputa locks
  // com janelas ainda ativas.
  if (Math.random() < 0.01) {
    await prisma.setting.deleteMany({
      where: {
        key: { startsWith: CRM_LEAD_RATE_LIMIT_PREFIX },
        updatedAt: { lt: new Date(agora - 24 * 60 * 60_000) },
      },
    })
  }

  return permitido
}
