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

export function msgPedidoConfirmado(nome: string, numeroPedido: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forzamotos.com.br'
  return `Oi *${nome}*! ✅ Seu pedido *#${numeroPedido}* foi confirmado!

Estamos separando seus produtos com cuidado. 📦

Você pode acompanhar o status do seu pedido em tempo real pelo link:
👉 ${baseUrl}/rastrear?pedido=${numeroPedido}

Obrigado por escolher a *Forza Motos*! 🏍️`
}

export function msgPedidoEnviado(nome: string, numeroPedido: string, rastreio: string, transportadora: string): string {
  return `🚀 *${nome}*, seu pedido *#${numeroPedido}* foi enviado!

📦 Código de rastreio: *${rastreio}*
🚚 Transportadora: ${transportadora}

Acompanhe pelo site da transportadora ou nos chame aqui para ajudar.

*Forza Motos* — obrigado pela preferência! 🏍️`
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
Segunda a Sexta: 8h às 18h
Sábado: 8h às 13h

Venha nos visitar! Te esperamos. 🏍️`
}
