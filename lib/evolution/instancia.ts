import { prisma } from '@/lib/prisma'

/**
 * Qual instância da Evolution está ativa.
 *
 * A fonte de verdade é o setting `evolution_instance`, gravado pela tela de
 * Configurações. A variável de ambiente é só o valor inicial.
 *
 * Isto mora num módulo próprio porque quem lia a variável de ambiente numa
 * constante de módulo (`const INSTANCE = process.env...`) ficava preso ao
 * valor do momento da importação: trocar a instância em Configurações não
 * chegava no funil de leads, que seguia apontando para a instância antiga —
 * inclusive depois dela ser apagada.
 */

const TTL_MS = 5 * 60 * 1000

let cache: { value: string; expiresAt: number } | null = null

function padrao() {
  return process.env.EVOLUTION_INSTANCE || 'forza-motos'
}

export async function getInstanciaAtiva(): Promise<string> {
  const agora = Date.now()
  if (cache && agora < cache.expiresAt) return cache.value

  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'evolution_instance' } })
    const value = setting?.value || padrao()
    cache = { value, expiresAt: agora + TTL_MS }
    return value
  } catch {
    // Banco fora do ar não pode derrubar o envio — cai no padrão sem cachear.
    return padrao()
  }
}

/**
 * Zera o cache. Precisa ser chamado sempre que a instância ativa mudar
 * (selecionar, criar, excluir), senão o sistema segue mandando mensagem para
 * a instância anterior por até 5 minutos — e, se ela foi apagada, para o vazio.
 */
export function invalidarCacheInstancia() {
  cache = null
}
