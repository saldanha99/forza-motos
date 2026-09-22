/** Remove espaços, pontos e outros separadores antes de validar/persistir. */
export function normalizarChaveNfe(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

/**
 * Valida a chave de acesso da NF-e/NFC-e: 43 dígitos de identificação e o
 * dígito verificador módulo 11. A chave nunca deve ser aceita só por tamanho,
 * porque um erro de digitação torna o envio comercial inválido.
 */
export function chaveNfeValida(valor: unknown): boolean {
  const chave = normalizarChaveNfe(valor)
  if (!/^\d{44}$/.test(chave)) return false

  let soma = 0
  let peso = 2
  for (let indice = 42; indice >= 0; indice -= 1) {
    soma += Number(chave[indice]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }

  const resto = soma % 11
  const digito = resto === 0 || resto === 1 ? 0 : 11 - resto
  return digito === Number(chave[43])
}

export function exigirChaveNfe(valor: unknown): string {
  const chave = normalizarChaveNfe(valor)
  if (!chaveNfeValida(chave)) {
    throw new Error('Informe uma chave NF-e válida com 44 dígitos antes de preparar o envio')
  }
  return chave
}

/** A IE varia por estado; para a loja de SP são esperados somente dígitos. */
export function exigirInscricaoEstadual(valor: unknown): string {
  const inscricao = String(valor ?? '').replace(/\D/g, '')
  if (!/^\d{8,14}$/.test(inscricao)) {
    throw new Error(
      'LOJA_INSCRICAO_ESTADUAL não configurada ou inválida — o Melhor Envio exige a IE real para envio comercial',
    )
  }
  return inscricao
}
