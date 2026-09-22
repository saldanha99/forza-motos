const MINUTOS_POR_DIA = 24 * 60

const minutosCompensacaoConfigurados = Number(
  process.env.PAGAMENTO_COMPENSACAO_MINUTOS ?? 3 * MINUTOS_POR_DIA,
)

/**
 * Pix, boleto e algumas análises de cartão podem levar horas para concluir.
 * Depois que o MP registra uma tentativa real em processamento, a reserva
 * precisa sobreviver ao prazo curto do link de checkout.
 */
export const MINUTOS_COMPENSACAO_PAGAMENTO =
  Number.isFinite(minutosCompensacaoConfigurados) && minutosCompensacaoConfigurados > 0
    ? Math.min(Math.max(Math.trunc(minutosCompensacaoConfigurados), 60), 7 * MINUTOS_POR_DIA)
    : 3 * MINUTOS_POR_DIA

const STATUS_EM_PROCESSAMENTO = new Set([
  'pending',
  'in_process',
  'authorized',
  'in_mediation',
])

export function pagamentoEmProcessamento(status: unknown): boolean {
  return typeof status === 'string' && STATUS_EM_PROCESSAMENTO.has(status)
}

export function calcularExpiracaoCompensacao(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + MINUTOS_COMPENSACAO_PAGAMENTO * 60_000)
}

export function maiorPrazo(atual: Date | null | undefined, minimo: Date): Date {
  return atual && atual > minimo ? atual : minimo
}
