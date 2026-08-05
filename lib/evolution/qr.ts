import QRCode from 'qrcode'

/**
 * Converte a resposta de `/instance/connect/{nome}` da Evolution num data URI
 * que o `<img>` consegue exibir.
 *
 * A Evolution devolve dois campos parecidos e fáceis de confundir:
 *
 *   base64 → "data:image/png;base64,iVBORw0KG..."   imagem pronta
 *   code   → "2@WxQkyg89FNcSB5JscjUH3x..."          payload de pareamento
 *
 * `code` é o conteúdo que o celular precisa ler, **não** uma imagem. Pegar
 * `code` e prefixar com `data:image/png;base64,` gera um src inválido — foi
 * exatamente esse o bug do QR quebrado no painel.
 *
 * Nem toda versão manda `base64`. Quando só vem `code`, o PNG é desenhado
 * aqui no servidor a partir da string.
 */
export async function resolverQrDataUri(connectData: any): Promise<string | null> {
  const imagem: string | undefined =
    connectData?.base64 ?? connectData?.qrcode?.base64 ?? connectData?.qr?.base64

  if (typeof imagem === 'string' && imagem.length > 0) {
    return imagem.startsWith('data:') ? imagem : `data:image/png;base64,${imagem}`
  }

  const payload: string | undefined = connectData?.code ?? connectData?.qrcode?.code
  if (typeof payload === 'string' && payload.length > 0) {
    try {
      return await QRCode.toDataURL(payload, { margin: 1, width: 320 })
    } catch {
      return null
    }
  }

  return null
}
