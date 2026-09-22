const PREFIXO_FALLBACK = 'fallback:'
const CODIGOS_CORREIOS_LEGADOS = new Set(['04014', '04510'])

export type OrigemServicoFrete = 'retirada' | 'melhor-envio' | 'fallback' | 'indefinido'

/**
 * Mantém a origem da cotação junto do identificador persistido no pedido.
 * Isso impede que códigos numéricos do fallback dos Correios sejam enviados
 * por engano para a API do Melhor Envio.
 */
export function idServicoFallback(codigo: string): string {
  const normalizado = String(codigo ?? '').trim()
  if (!normalizado) throw new Error('Código do serviço de fallback inválido')
  return `${PREFIXO_FALLBACK}${normalizado}`
}

/**
 * Classifica também os dois códigos gravados pela versão antiga, sem exigir
 * migração dos pedidos já existentes.
 */
export function origemServicoFrete(servico: string | null | undefined): OrigemServicoFrete {
  const valor = String(servico ?? '').trim()
  if (!valor) return 'indefinido'
  if (valor === 'retirada') return 'retirada'
  if (valor.startsWith(PREFIXO_FALLBACK) || CODIGOS_CORREIOS_LEGADOS.has(valor)) {
    return 'fallback'
  }
  return /^\d+$/.test(valor) ? 'melhor-envio' : 'fallback'
}

export function ehServicoMelhorEnvio(servico: string | null | undefined): boolean {
  return origemServicoFrete(servico) === 'melhor-envio'
}
