const CODIGO_QR = /^[A-Za-z0-9_-]{16,100}$/

/** Aceita o token puro ou a URL completa emitida no QR/por um leitor USB 2D. */
export function extrairCodigoQrEvento(valor: string) {
  const entrada = valor.trim()
  if (CODIGO_QR.test(entrada)) return entrada
  try {
    const url = new URL(entrada, 'https://evento.forza.local')
    const codigo = url.searchParams.get('codigo')?.trim() ?? ''
    return CODIGO_QR.test(codigo) ? codigo : null
  } catch {
    return null
  }
}
