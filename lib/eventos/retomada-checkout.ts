const UUID_CHECKOUT_EVENTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSAO_REGISTRO = 1
const VALIDADE_REGISTRO_MS = 30 * 24 * 60 * 60 * 1_000

export interface ArmazenamentoCheckoutEvento {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
  removeItem(chave: string): void
}

export interface TentativaCheckoutEventoSalva {
  versao: 1
  checkoutTentativaId: string
  criadaEm: number
}

export type StatusInscricaoRetomada = 'PENDENTE' | 'PAGO' | 'CANCELADO'

export const STATUS_PAGAMENTO_EVENTO_EM_PROCESSAMENTO = [
  'pending',
  'in_process',
  'authorized',
  'in_mediation',
]

export function checkoutTentativaEventoValida(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_CHECKOUT_EVENTO.test(valor.trim())
}

export function chaveTentativaCheckoutEvento(slug: string) {
  return `forza-evento-checkout:${encodeURIComponent(slug.trim().toLowerCase())}:v1`
}

export function salvarTentativaCheckoutEvento(
  armazenamento: ArmazenamentoCheckoutEvento,
  slug: string,
  checkoutTentativaId: string,
  agora = Date.now(),
) {
  if (!checkoutTentativaEventoValida(checkoutTentativaId)) {
    throw new Error('Tentativa de checkout inválida.')
  }
  const registro: TentativaCheckoutEventoSalva = {
    versao: VERSAO_REGISTRO,
    checkoutTentativaId: checkoutTentativaId.trim().toLowerCase(),
    criadaEm: agora,
  }
  armazenamento.setItem(chaveTentativaCheckoutEvento(slug), JSON.stringify(registro))
  return registro
}

export function limparTentativaCheckoutEvento(
  armazenamento: ArmazenamentoCheckoutEvento,
  slug: string,
) {
  armazenamento.removeItem(chaveTentativaCheckoutEvento(slug))
}

export function lerTentativaCheckoutEvento(
  armazenamento: ArmazenamentoCheckoutEvento,
  slug: string,
  agora = Date.now(),
): TentativaCheckoutEventoSalva | null {
  const chave = chaveTentativaCheckoutEvento(slug)
  const valor = armazenamento.getItem(chave)
  if (!valor) return null

  try {
    const registro = JSON.parse(valor) as Partial<TentativaCheckoutEventoSalva>
    const valido =
      registro.versao === VERSAO_REGISTRO &&
      checkoutTentativaEventoValida(registro.checkoutTentativaId) &&
      typeof registro.criadaEm === 'number' &&
      Number.isFinite(registro.criadaEm) &&
      registro.criadaEm <= agora &&
      agora - registro.criadaEm <= VALIDADE_REGISTRO_MS

    if (!valido) throw new Error('Registro inválido')
    return registro as TentativaCheckoutEventoSalva
  } catch {
    armazenamento.removeItem(chave)
    return null
  }
}

export function reservaCheckoutEventoAtiva(
  inscricao: {
    status: StatusInscricaoRetomada
    reservaExpiraEm: Date | null
    pagamentoResultadoIncerto: boolean
  },
  agora = new Date(),
) {
  if (inscricao.status !== 'PENDENTE') return false
  return Boolean(
    inscricao.pagamentoResultadoIncerto ||
    !inscricao.reservaExpiraEm ||
    inscricao.reservaExpiraEm > agora,
  )
}
