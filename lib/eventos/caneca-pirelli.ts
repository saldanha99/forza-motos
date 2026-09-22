export type StatusCanecaPirelli = 'PENDENTE' | 'EM_GRAVACAO' | 'PRONTA' | 'ENTREGUE' | 'CANCELADA'

const TRANSICOES: Record<StatusCanecaPirelli, readonly StatusCanecaPirelli[]> = {
  PENDENTE: ['EM_GRAVACAO', 'CANCELADA'],
  EM_GRAVACAO: ['PRONTA', 'CANCELADA'],
  PRONTA: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADA: [],
}

export function statusCanecaPirelli(valor: unknown): valor is StatusCanecaPirelli {
  return typeof valor === 'string' && valor in TRANSICOES
}

export function transicaoCanecaPirelliPermitida(atual: StatusCanecaPirelli, proximo: StatusCanecaPirelli) {
  return TRANSICOES[atual].includes(proximo)
}
