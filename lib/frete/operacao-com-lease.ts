export type ResultadoOperacaoComLease<T> =
  | { adquirido: false }
  | { adquirido: true; valor: T }

/**
 * Orquestra uma chamada externa protegida por lease. Só quem recebe um token
 * executa; erro libera o token para retry. Sucesso é finalizado pelo callback.
 */
export async function executarComLease<T>(deps: {
  adquirir: () => Promise<string | null>
  executar: (token: string) => Promise<T>
  liberar: (token: string) => Promise<void>
}): Promise<ResultadoOperacaoComLease<T>> {
  const token = await deps.adquirir()
  if (!token) return { adquirido: false }
  try {
    return { adquirido: true, valor: await deps.executar(token) }
  } catch (error) {
    await deps.liberar(token)
    throw error
  }
}
