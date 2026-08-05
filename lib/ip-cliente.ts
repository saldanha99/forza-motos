import { isIP } from 'node:net'

/**
 * Identidade de origem para rate limit, em um lugar só.
 *
 * Os três limitadores públicos (captação do CRM, agendamento e cadastro do
 * evento) ficam atrás do mesmo proxy e precisam concordar sobre quem é o
 * chamador. Antes havia três cópias e duas delas validavam o IP com o regex
 * `/^[0-9a-fA-F:.]+$/`, que aceita `"...."`, `"::::"` ou `"9.9.9.9.9.9"` como
 * endereço. Como cada string vira um bucket próprio, bastava rotacionar lixo no
 * cabeçalho para nunca bater no limite — o furo exato que o limitador existe
 * para fechar.
 */

/** Só um endereço IP de verdade vira chave de bucket; o resto é descartado. */
export function ipClienteValido(valor: string | undefined | null): string | null {
  let ip = valor?.trim()
  if (!ip || ip.length > 64) return null

  // Formas que proxies emitem: "[::1]:443" e "1.2.3.4:5678".
  const comColchetes = ip.match(/^\[([^\]]+)\](?::\d+)?$/)
  if (comColchetes) ip = comColchetes[1]
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'))

  return isIP(ip) ? ip : null
}

/**
 * Usa o ÚLTIMO salto do `X-Forwarded-For` — o valor que o proxy acrescenta, o
 * mais próximo da infraestrutura — nunca o primeiro, que o cliente controla.
 * Sem identidade confiável, devolve um bucket compartilhado e conservador em
 * vez de permitir bypass por strings arbitrárias.
 *
 * Não lemos `x-vercel-forwarded-for`. Ele já esteve aqui em primeiro lugar,
 * herdado de outro deploy, e era um bypass completo: esta aplicação roda em VPS
 * atrás do traefik, nada no stack emite esse cabeçalho, então quem o mandasse
 * seria sempre o próprio cliente. Validar que é um IP de verdade não resolve —
 * basta mandar `203.0.113.1`, `203.0.113.2`, … e cada requisição estreia um
 * bucket novo. Um cabeçalho que ninguém confiável escreve não pode ter
 * precedência sobre o que o proxy escreveu.
 */
export function origemDaRequisicao(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')?.split(',').at(-1)
  const real = req.headers.get('x-real-ip') ?? undefined
  return ipClienteValido(xff) ?? ipClienteValido(real) ?? 'desconhecido'
}
