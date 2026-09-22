import { createHash, createHmac, randomInt } from 'node:crypto'

export const DURACAO_CODIGO_RECUPERACAO_MS = 10 * 60_000
export const CODIGO_RECUPERACAO = /^\d{6}$/
export const PREFIXO_IDENTIFICADOR_RECUPERACAO = 'evento-pirelli-recuperacao:'

export function novoCodigoRecuperacao() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export function identificadorRecuperacao(eventoId: string, whatsapp: string) {
  const telefoneHash = createHash('sha256').update(whatsapp).digest('hex')
  return `${PREFIXO_IDENTIFICADOR_RECUPERACAO}${eventoId}:${telefoneHash}`
}

export function hashCodigoRecuperacao(
  identificador: string,
  codigo: string,
  segredo: string,
) {
  return createHmac('sha256', segredo)
    .update(`v1:${identificador}:${codigo}`)
    .digest('base64url')
}

export function segredoRecuperacaoEventoPirelli() {
  const segredo = process.env.EVENTO_PIRELLI_RECUPERACAO_SECRET
    || process.env.NEXTAUTH_SECRET
    || ''
  if (segredo.length < 24) {
    throw new Error('Segredo de recuperação do Evento Pirelli não configurado.')
  }
  return segredo
}

export function expiracaoCodigoRecuperacao(agora = new Date()) {
  return new Date(agora.getTime() + DURACAO_CODIGO_RECUPERACAO_MS)
}

export function mensagemCodigoRecuperacao(codigo: string) {
  return (
    `🔐 *Forza Motos — Evento Pirelli*\n\n` +
    `Seu código para recuperar o acesso é: *${codigo}*\n\n` +
    `Ele vale por 10 minutos e pode ser usado uma única vez. ` +
    `Não compartilhe este código com ninguém.`
  )
}

export function normalizarEmailRecuperacao(email: string | null | undefined) {
  const normalizado = email?.trim().toLowerCase() ?? ''
  if (
    normalizado.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)
  ) return null
  return normalizado
}

export type ResultadoEntregaCodigoRecuperacao = {
  whatsappEntregue: boolean
  emailEntregue: boolean
  algumCanalEntregue: boolean
}

export function deveManterCodigoRecuperacao(
  whatsappEntregue: boolean,
  emailEntregue: boolean,
) {
  return whatsappEntregue || emailEntregue
}

type DependenciasEntregaCodigoRecuperacao = {
  enviarWhatsapp: (entrada: { whatsapp: string; codigo: string }) => Promise<{ ok: boolean }>
  enviarEmail: (entrada: { email: string; codigo: string }) => Promise<{ enviado: boolean }>
}

/**
 * Dispara o mesmo OTP nos canais cadastrados sem deixar a falha de um canal
 * cancelar o outro. `allSettled` também absorve exceções dos provedores sem
 * vazar detalhes ou PII para a resposta pública.
 */
export async function entregarCodigoRecuperacaoNosCanais(
  entrada: { whatsapp: string; email?: string | null; codigo: string },
  deps: DependenciasEntregaCodigoRecuperacao,
): Promise<ResultadoEntregaCodigoRecuperacao> {
  const email = normalizarEmailRecuperacao(entrada.email)
  const [whatsapp, correio] = await Promise.allSettled([
    deps.enviarWhatsapp({ whatsapp: entrada.whatsapp, codigo: entrada.codigo }),
    email
      ? deps.enviarEmail({ email, codigo: entrada.codigo })
      : Promise.resolve({ enviado: false }),
  ])
  const whatsappEntregue = whatsapp.status === 'fulfilled' && whatsapp.value.ok
  const emailEntregue = correio.status === 'fulfilled' && correio.value.enviado
  return {
    whatsappEntregue,
    emailEntregue,
    algumCanalEntregue: deveManterCodigoRecuperacao(whatsappEntregue, emailEntregue),
  }
}
