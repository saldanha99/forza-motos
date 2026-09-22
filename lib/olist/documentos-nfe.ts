import { tinyFetch, tinyFetchTexto } from '@/lib/olist/client'
import { interpretarPedidoOlistFiscal } from '@/lib/olist/nfe-envio-core'

const ID_FISCAL = /^[1-9]\d{0,19}$/
const HOST_DANFE_OLIST = 'erp.olist.com'

function exigirIdFiscal(valor: unknown, nome: string): string {
  const id = String(valor ?? '').trim()
  if (!ID_FISCAL.test(id)) throw new Error(`${nome} inválido`)
  return id
}

function decodificarEntidadesXml(valor: string): string {
  return valor
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Extrai apenas a NF-e real; nunca devolve o envelope de resposta da API. */
export function extrairXmlNfeDaRespostaOlist(resposta: string): string {
  const erro = resposta.match(/<erro(?:\s[^>]*)?>([\s\S]*?)<\/erro>/i)?.[1]
  if (/<status>\s*Erro\s*<\/status>/i.test(resposta)) {
    const detalhe = erro
      ? decodificarEntidadesXml(erro.replace(/<[^>]+>/g, '')).trim().slice(0, 200)
      : 'erro não detalhado'
    throw new Error(`Olist não forneceu o XML da NF-e: ${detalhe}`)
  }

  const conteudo = resposta.match(/<xml_nfe(?:\s[^>]*)?>([\s\S]*?)<\/xml_nfe>/i)?.[1]
  if (!conteudo) throw new Error('Olist não devolveu o XML da NF-e')

  let xml = conteudo.trim()
  const cdata = xml.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)
  if (cdata) xml = cdata[1].trim()
  if (/^&lt;/.test(xml)) xml = decodificarEntidadesXml(xml).trim()

  // A NF-e é enviada como arquivo, não analisada. Ainda assim recusamos DTD e
  // entidades para que consumidores do anexo não sejam expostos a XXE.
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new Error('XML da NF-e contém declaração não permitida')
  }
  if (!/<(?:[a-z][\w.-]*:)?(?:nfeProc|NFe)\b/i.test(xml)) {
    throw new Error('Conteúdo devolvido pela Olist não é uma NF-e válida')
  }

  return /^<\?xml\b/i.test(xml)
    ? xml
    : `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`
}

/** Somente links HTTPS do domínio oficial atual da Olist podem ir ao cliente. */
export function validarLinkDanfeOlist(valor: unknown): string | null {
  try {
    const url = new URL(String(valor ?? '').trim())
    if (url.protocol !== 'https:') return null
    if (url.hostname.toLowerCase() !== HOST_DANFE_OLIST) return null
    if (url.username || url.password) return null
    if (url.port && url.port !== '443') return null
    if (url.href.length > 2048) return null
    return url.href
  } catch {
    return null
  }
}

export function xmlNfeCorrespondeAChave(xml: string, chaveInformada: unknown): boolean {
  const chave = String(chaveInformada ?? '').replace(/\D/g, '')
  return /^\d{44}$/.test(chave) && new RegExp(`\\bId=["']NFe${chave}["']`).test(xml)
}

export async function obterIdNotaFiscalPorPedidoOlist(
  olistOrderIdInformado: string,
): Promise<string | null> {
  const olistOrderId = exigirIdFiscal(olistOrderIdInformado, 'Pedido Olist')
  const resposta = await tinyFetch('pedido.obter.php', { id: olistOrderId })
  const pedido = interpretarPedidoOlistFiscal(resposta)
  if (!pedido) throw new Error('Olist não devolveu os dados do pedido')
  if (pedido.id !== olistOrderId) {
    throw new Error('Olist devolveu um pedido diferente do solicitado')
  }
  return pedido.idNotaFiscal
}

export async function obterXmlNfeOlist(idNotaFiscalInformado: string): Promise<string> {
  const idNotaFiscal = exigirIdFiscal(idNotaFiscalInformado, 'NF-e Olist')
  const resposta = await tinyFetchTexto('nota.fiscal.obter.xml.php', { id: idNotaFiscal })
  return extrairXmlNfeDaRespostaOlist(resposta)
}

export async function obterLinkDanfeOlist(
  idNotaFiscalInformado: string,
): Promise<string | null> {
  const idNotaFiscal = exigirIdFiscal(idNotaFiscalInformado, 'NF-e Olist')
  const resposta = await tinyFetch('nota.fiscal.obter.link.php', { id: idNotaFiscal })
  return validarLinkDanfeOlist(resposta.retorno?.link_nfe)
}

export async function obterDocumentosNfeOlist(
  idNotaFiscal: string,
  chaveEsperada?: string | null,
): Promise<{ xml: string; danfeUrl: string | null }> {
  // Chamadas sequenciais respeitam o ritmo conservador já adotado pelo cliente.
  const xml = await obterXmlNfeOlist(idNotaFiscal)
  if (chaveEsperada && !xmlNfeCorrespondeAChave(xml, chaveEsperada)) {
    throw new Error('O XML devolvido pela Olist não corresponde à chave da NF-e do pedido')
  }
  const danfeUrl = await obterLinkDanfeOlist(idNotaFiscal)
  return { xml, danfeUrl }
}
