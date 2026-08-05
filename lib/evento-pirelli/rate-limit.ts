import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { origemDaRequisicao } from '@/lib/ip-cliente'

export const PREFIXO_RATE_LIMIT_REGISTRO_PIRELLI = 'rate_limit:evento_pirelli_registro:'
const JANELA_MS = 60_000

/**
 * O público real está no estande, atrás de um único IP de NAT (Wi-Fi da loja ou
 * operadora), e uma fila com atendente faz poucos cadastros por minuto. 20/min
 * por origem dá folga de várias vezes o uso real e ainda assim corta rajada de
 * script; 5/min por WhatsApp cobre retry humano sem permitir martelar o mesmo
 * número. Rotação de números continua limitada pelo teto de origem.
 */
export const LIMITE_REGISTRO_POR_IP = 20
export const LIMITE_REGISTRO_POR_WHATSAPP = 5

export type EscopoLimiteRegistro = 'ip' | 'whatsapp'

type Estado = { inicio: number; tentativas: number }

/**
 * Usa o salto mais próximo do proxy (último valor do XFF), não o primeiro, que é
 * escrito pelo cliente, e só aceita IP de verdade: com a validação por regex que
 * este módulo herdou, qualquer string de pontos e dígitos virava um bucket novo
 * e o limite caía só rotacionando lixo no cabeçalho. Sem proxy conhecido, todos
 * caem no mesmo bucket conservador.
 */
export function ipDoRegistro(req: Request) {
  return origemDaRequisicao(req)
}

/** Hash impede guardar IP/telefone em claro numa tabela de configuração. */
function chavePersistida(escopo: EscopoLimiteRegistro, identidade: string) {
  const hash = createHash('sha256').update(`${escopo}:${identidade}`).digest('hex')
  return `${PREFIXO_RATE_LIMIT_REGISTRO_PIRELLI}${escopo}:${hash}`
}

/**
 * Janela fixa compartilhada pelo PostgreSQL, no mesmo formato usado pela captação
 * do CRM: a linha fica bloqueada (FOR UPDATE) durante a contagem, então dois
 * processos não conseguem consumir o mesmo último crédito, e o limite sobrevive a
 * restart/deploy no meio do evento. Falha de banco propaga para o chamador
 * (fail-closed) em vez de liberar a rajada.
 */
export async function consumirLimiteRegistro(
  escopo: EscopoLimiteRegistro,
  identidade: string,
  limite: number,
  agora = Date.now(),
) {
  const chave = chavePersistida(escopo, identidade)
  const inicial = JSON.stringify({ inicio: agora, tentativas: 0 } satisfies Estado)

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
      estado = JSON.parse(linhas[0]?.value ?? '') as Estado
      if (!Number.isFinite(estado.inicio) || !Number.isInteger(estado.tentativas)) throw new Error('estado inválido')
    } catch {
      estado = { inicio: agora, tentativas: 0 }
    }
    if (agora - estado.inicio >= JANELA_MS) estado = { inicio: agora, tentativas: 0 }
    if (estado.tentativas >= limite) return false

    estado.tentativas += 1
    await tx.setting.update({ where: { key: chave }, data: { value: JSON.stringify(estado) } })
    return true
  })
}

/**
 * Limpeza probabilística: sem ela cada IP/telefone do evento deixaria uma linha
 * permanente em Setting. A folga de um dia não disputa lock com janelas ativas.
 */
export async function limparJanelasAntigasDoRegistro(agora = Date.now()) {
  if (Math.random() >= 0.02) return
  await prisma.setting.deleteMany({
    where: {
      key: { startsWith: PREFIXO_RATE_LIMIT_REGISTRO_PIRELLI },
      updatedAt: { lt: new Date(agora - 24 * 60 * 60_000) },
    },
  }).catch((erro) => console.error('[evento-pirelli/rate-limit] limpeza falhou:', erro))
}
