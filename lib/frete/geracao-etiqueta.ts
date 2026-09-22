interface ImpressaoEtiqueta {
  url?: string
}

interface GerarEObterImpressaoInput {
  gerar: () => Promise<unknown>
  imprimir: () => Promise<ImpressaoEtiqueta>
  /** Em um retry, tenta aproveitar uma geração remota que já terminou. */
  tentarImpressaoInicial?: boolean
  esperasMs?: number[]
  esperar?: (ms: number) => Promise<void>
}

const esperarPadrao = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * A geração do Melhor Envio é assíncrona. Esta rotina aguarda a impressão e,
 * se ela ainda não estiver pronta, termina de forma recuperável: o pedido fica
 * COMPRADA e o administrador pode tentar novamente sem novo débito.
 */
export async function gerarEObterImpressao({
  gerar,
  imprimir,
  tentarImpressaoInicial = false,
  esperasMs = [1_500, 3_000, 5_000],
  esperar = esperarPadrao,
}: GerarEObterImpressaoInput): Promise<{ url: string }> {
  let ultimoErro: unknown = null

  if (tentarImpressaoInicial) {
    try {
      const impressao = await imprimir()
      if (impressao?.url) return { url: impressao.url }
    } catch (error) {
      ultimoErro = error
    }
  }

  try {
    await gerar()
  } catch (error) {
    // Um retry pode encontrar a etiqueta já gerada remotamente. Ainda assim,
    // tentamos obter o PDF antes de apresentar o erro ao administrador.
    ultimoErro = error
  }

  for (const esperaMs of esperasMs) {
    if (esperaMs > 0) await esperar(esperaMs)
    try {
      const impressao = await imprimir()
      if (impressao?.url) return { url: impressao.url }
    } catch (error) {
      ultimoErro = error
    }
  }

  const detalhe = ultimoErro instanceof Error
    ? ` Detalhe: ${ultimoErro.message.slice(0, 180)}`
    : ''
  throw new Error(
    'A etiqueta foi comprada, mas o PDF ainda não ficou disponível. ' +
      'Aguarde alguns instantes e use “Gerar/recuperar etiqueta”; não haverá nova cobrança.' +
      detalhe,
  )
}
