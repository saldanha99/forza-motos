/**
 * Templates de mensagens WhatsApp — Forza Motos
 * Cada função retorna o texto final pronto para envio.
 */

export function msgBoasVindas(nome: string): string {
  return `Oi ${nome}! 👋 Aqui é a *Forza Motos* de Campinas.

Vi que você se interessou pela nossa loja! Pode contar com a gente para qualquer dúvida sobre pneus, peças ou serviços. 🏍️

Temos mais de *2.800 produtos* em estoque e *box rápido com agendamento* — troca de pneu em 30 minutos!

É só chamar aqui. 😊`
}

export function msgAgendamento(nome: string, servico: string, data: string, horario: string, moto: string): string {
  return `Olá *${nome}*! ✅

Seu agendamento na *Forza Motos* está confirmado!

🔧 Serviço: ${servico}
🏍️ Moto: ${moto}
📅 Data: ${data}
⏰ Horário: ${horario}

📍 R. Funilense, 110 — Campinas/SP
📞 (19) 97404-9445

Qualquer dúvida é só responder aqui. Te esperamos! 🏁`
}

export interface OpcoesPedidoConfirmado {
  preVenda?: boolean
  prazoPreVendaDias?: number | null
  prazoTotalDias?: number | null
  retirada?: boolean
  nomeCampanha?: string | null
  canecaEventoPirelli?: boolean
  nomeGravacao?: string | null
  quantidadeCanecas?: number | null
  linkConfirmacaoCaneca?: string | null
}

export function msgPedidoConfirmado(
  nome: string,
  numeroPedido: string,
  opcoes: OpcoesPedidoConfirmado = {},
): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forzamotos.com.br'
  if (opcoes.canecaEventoPirelli) {
    const quantidade = Math.max(1, opcoes.quantidadeCanecas ?? 1)
    const gravacao = opcoes.nomeGravacao
      ? `\n✍️ Nome para gravação: *${opcoes.nomeGravacao}*.`
      : ''
    return `Oi *${nome}*! ✅ O pagamento da sua caneca foi aprovado!

🧾 Pedido: *#${numeroPedido}*
☕ Quantidade: *${quantidade} ${quantidade === 1 ? 'caneca' : 'canecas'}*.${gravacao}

Sua compra já está vinculada ao seu cadastro da experiência Pirelli. A equipe verá a confirmação automaticamente.

Confira sua compra e acompanhe a gravação:
👉 ${opcoes.linkConfirmacaoCaneca || `${baseUrl}/evento-pirelli`}

Obrigado por participar com a *Forza Motos*! 🏁`
  }
  if (opcoes.preVenda) {
    const campanha = opcoes.nomeCampanha ? ` da campanha *${opcoes.nomeCampanha}*` : ''
    const disponibilidade = opcoes.prazoPreVendaDias
      ? `\n⏳ Disponibilidade: até *${opcoes.prazoPreVendaDias} dias úteis*.`
      : ''
    const prazoTotal = opcoes.prazoTotalDias
      ? `\n🚚 Prazo total estimado no checkout: até *${opcoes.prazoTotalDias} dias úteis*.`
      : ''
    const retirada = opcoes.retirada
      ? '\n📍 Aguarde nosso aviso de pedido pronto antes de ir à loja.'
      : ''
    return `Oi *${nome}*! ✅ Seu pedido *#${numeroPedido}* foi confirmado!

Seu pagamento foi aprovado e sua *pré-venda*${campanha} está reservada. Os produtos não estão disponíveis para envio ou retirada imediata.${disponibilidade}${prazoTotal}${retirada}

Você pode acompanhar o status em:
👉 ${baseUrl}/rastrear?pedido=${numeroPedido}

Obrigado por escolher a *Forza Motos*! 🏍️`
  }
  return `Oi *${nome}*! ✅ Seu pedido *#${numeroPedido}* foi confirmado!

Estamos separando seus produtos com cuidado. 📦

Você pode acompanhar o status do seu pedido em tempo real pelo link:
👉 ${baseUrl}/rastrear?pedido=${numeroPedido}

Obrigado por escolher a *Forza Motos*! 🏍️`
}

export function msgPedidoEnviado(nome: string, numeroPedido: string, rastreio: string, transportadora: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forzamotos.com.br'
  return `🚀 *${nome}*, seu pedido *#${numeroPedido}* foi enviado!

📦 Código de rastreio: *${rastreio}*
🚚 Transportadora: ${transportadora}

Acompanhe o andamento em:
👉 ${baseUrl}/rastrear?pedido=${numeroPedido}

*Forza Motos* — obrigado pela preferência! 🏍️`
}

export function msgPedidoEntregue(nome: string, numeroPedido: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forzamotos.com.br'
  return `📦 *${nome}*, seu pedido *#${numeroPedido}* foi entregue!

Esperamos que tenha chegado tudo certinho. Se precisar de ajuda com o produto ou com o pedido, responda esta mensagem e fale com a equipe da *Forza Motos*.

Detalhes do pedido:
👉 ${baseUrl}/rastrear?pedido=${numeroPedido}

Obrigado pela confiança! 🏍️`
}

export function msgCarrinhoAbandonado(nome: string, produtos: string[]): string {
  const lista = produtos.map(p => `• ${p}`).join('\n')
  return `Oi *${nome}*! 🛒

Você deixou alguns produtos no carrinho da Forza Motos:

${lista}

Ainda estão disponíveis! Precisa de ajuda para finalizar o pedido ou tem alguma dúvida? É só chamar aqui. 😊

👉 forzamotos.com.br`
}

export function msgPosVenda(nome: string): string {
  return `Oi *${nome}*! 😊

Como foram os produtos que você pediu na *Forza Motos*?

Sua opinião é muito importante pra gente melhorar cada vez mais. Se quiser compartilhar sua experiência, pode nos avaliar no Google!

⭐ bit.ly/avalie-forza

Qualquer dúvida ou problema, é só chamar. Estamos aqui! 🏍️`
}

export function msgReativacao(nome: string): string {
  return `Oi *${nome}*! Faz um tempinho que não te vemos por aqui. 😊

A *Forza Motos* tem novidades e promoções esperando por você!

🏍️ Pneus, peças, óleos e muito mais em:
👉 forzamotos.com.br

Precisando de qualquer coisa — pode chamar! 🔧`
}

export function msgIngressoConfirmado(nome: string, tituloEvento: string, quantidade: number, total: string): string {
  return `🎉 *${nome}*, seu ingresso está confirmado!

🏁 *${tituloEvento}*

🎟️ ${quantidade} ingresso${quantidade > 1 ? 's' : ''} — *${total}*

Em breve enviaremos mais detalhes sobre o evento por aqui.

Qualquer dúvida é só chamar — *Forza Motos* 🏍️`
}

export function msgPedidoProntoRetirada(nome: string, numeroPedido: string): string {
  return `Olá *${nome}*! 🏁 Seu pedido *#${numeroPedido}* já está separado e *pronto para retirada* na nossa loja!

📍 Endereço de Retirada:
Forza Motos
Rua Funilense, 110 — Guanabara
Campinas/SP

⏰ Horário de funcionamento:
Segunda a Sexta: 9h às 18h
Sábado: 8h às 12h

Venha nos visitar! Te esperamos. 🏍️`
}
