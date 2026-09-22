import { formatPrice } from '@/lib/utils'

interface ItemEmail {
  nome: string
  quantidade: number
  precoUnitario: number | string
  preVenda?: boolean
  prazoEntregaDias?: number | null
}

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// ─── E-mail de confirmação de pedido ───────────────────────────────────────

export function htmlPedidoConfirmado(opts: {
  nomeCliente: string
  numeroPedido: string
  itens: ItemEmail[]
  subtotal: number
  frete: number
  total: number
  freteTransportadora?: string | null
  fretePrazo?: number | null
  preVenda?: boolean
  prazoPreVendaDias?: number | null
  prazoTotalDias?: number | null
  retirada?: boolean
  nomeCampanha?: string | null
  canecaEventoPirelli?: boolean
  nomeGravacao?: string | null
  quantidadeCanecas?: number | null
  linkConfirmacaoCaneca?: string | null
}) {
  const { nomeCliente, numeroPedido, itens, subtotal, frete, total, freteTransportadora, fretePrazo } = opts
  const preVenda = opts.preVenda === true || itens.some((item) => item.preVenda === true)
  const prazoPreVendaDias = opts.prazoPreVendaDias ?? null
  const prazoTotalDias = opts.prazoTotalDias ?? fretePrazo ?? null
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forzamotos.com.br'
  const trackingUrl = opts.canecaEventoPirelli
    ? escaparHtml(opts.linkConfirmacaoCaneca || `${baseUrl}/evento-pirelli`)
    : `${baseUrl}/rastrear?pedido=${numeroPedido}`

  const itensHtml = itens
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#333; font-size:14px;">${i.nome}${i.preVenda ? `<br><span style="color:#b45309;font-size:12px;font-weight:600;">Pré-venda${i.prazoEntregaDias ? ` · disponibilidade em até ${i.prazoEntregaDias} dias úteis` : ''}</span>` : ''}</td>
        <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#555; font-size:14px; text-align:center;">${i.quantidade}x</td>
        <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#333; font-size:14px; text-align:right;">${formatPrice(Number(i.precoUnitario) * i.quantidade)}</td>
      </tr>`,
    )
    .join('')

  const prazoTexto = !opts.canecaEventoPirelli && fretePrazo
    ? `(${preVenda ? 'prazo total estimado' : 'prazo estimado'}: ${fretePrazo} dias úteis)`
    : ''
  const transportadoraTexto = !opts.canecaEventoPirelli && freteTransportadora
    ? ` via ${freteTransportadora}`
    : ''
  const heroTexto = opts.canecaEventoPirelli
    ? 'Seu pagamento foi aprovado e sua caneca personalizada entrou na fila da experiência Pirelli.'
    : preVenda
      ? 'Seu pagamento foi aprovado e os produtos de pré-venda foram reservados para você.'
      : 'Seu pagamento foi aprovado e já estamos separando seu pedido.'
  const avisoPreVenda = opts.canecaEventoPirelli
    ? `<tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#fff7ed;border:1px solid #fdba74;border-left:4px solid #f59e0b;border-radius:6px;padding:18px;">
              <h3 style="margin:0 0 8px;color:#9a3412;font-size:15px;font-weight:700;">☕ Caneca vinculada ao seu cadastro</h3>
              <p style="margin:0;color:#7c2d12;font-size:13px;line-height:1.5;">Quantidade: <strong>${Math.max(1, opts.quantidadeCanecas ?? 1)}</strong>${opts.nomeGravacao ? ` · Nome para gravação: <strong>${opts.nomeGravacao}</strong>` : ''}.</p>
              <p style="margin:8px 0 0;color:#7c2d12;font-size:13px;line-height:1.5;">A equipe verá automaticamente o pagamento confirmado e acompanhará a gravação e a entrega.</p>
            </div>
          </td>
        </tr>`
    : preVenda
    ? `<tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#fff7ed;border:1px solid #fdba74;border-left:4px solid #f59e0b;border-radius:6px;padding:18px;">
              <h3 style="margin:0 0 8px;color:#9a3412;font-size:15px;font-weight:700;">⏳ Compra em pré-venda${opts.nomeCampanha ? ` — ${opts.nomeCampanha}` : ''}</h3>
              <p style="margin:0;color:#7c2d12;font-size:13px;line-height:1.5;">Este pedido não está disponível para envio ou retirada imediata.${prazoPreVendaDias ? ` O maior prazo de disponibilidade prometido é de até <strong>${prazoPreVendaDias} dias úteis</strong>.` : ''}${prazoTotalDias ? ` O prazo total estimado informado no checkout é de até <strong>${prazoTotalDias} dias úteis</strong>.` : ''}</p>
              ${opts.retirada ? '<p style="margin:8px 0 0;color:#7c2d12;font-size:13px;line-height:1.5;"><strong>Aguarde nosso aviso de pedido pronto antes de ir à loja.</strong></p>' : ''}
            </div>
          </td>
        </tr>`
    : ''
  const proximosPassos = opts.canecaEventoPirelli
    ? `<p style="margin:0 0 8px;color:#555;font-size:13px;">1. Confira sua compra pelo link seguro deste e-mail</p>
       <p style="margin:0 0 8px;color:#555;font-size:13px;">2. A equipe verá automaticamente sua confirmação no painel</p>
       <p style="margin:0;color:#555;font-size:13px;">3. Acompanhe a personalização até a entrega</p>`
    : preVenda
      ? `<p style="margin:0 0 8px;color:#555;font-size:13px;">1. Sua pré-venda está confirmada e aguardaremos a disponibilidade dos produtos</p>
         <p style="margin:0 0 8px;color:#555;font-size:13px;">2. Avisaremos quando o pedido estiver pronto para envio ou retirada</p>
         <p style="margin:0;color:#555;font-size:13px;">3. Acompanhe o andamento pelo link deste e-mail</p>`
      : `<p style="margin:0 0 8px;color:#555;font-size:13px;">1. Estamos separando e embalando seu pedido</p>
         <p style="margin:0 0 8px;color:#555;font-size:13px;">2. Em breve você receberá o código de rastreio</p>
         <p style="margin:0;color:#555;font-size:13px;">3. Acompanhe seu pedido pelo link que enviaremos</p>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#e63946;padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FORZA MOTOS</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Pneus e Peças para Moto</p>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 16px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">✅</div>
            <h2 style="color:#1a1a1a;margin:0 0 8px;font-size:22px;font-weight:700;">${opts.canecaEventoPirelli ? 'Caneca Confirmada!' : 'Pedido Confirmado!'}</h2>
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! ${heroTexto}</p>
          </td>
        </tr>

        <!-- Número do pedido -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#fff8f0;border:1px solid #ffe0b2;border-radius:6px;padding:16px;text-align:center;">
              <p style="margin:0;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Número do Pedido</p>
              <p style="margin:4px 0 0;color:#e63946;font-size:22px;font-weight:700;font-family:monospace;">${numeroPedido}</p>
              <div style="margin-top: 12px;">
                <a href="${trackingUrl}" style="display:inline-block;background:#e63946;color:#fff;text-decoration:none;padding:10px 24px;border-radius:20px;font-size:13px;font-weight:600;">${opts.canecaEventoPirelli ? '☕ Conferir minha caneca' : '🔍 Acompanhar em Tempo Real'}</a>
              </div>
            </div>
          </td>
        </tr>

        ${avisoPreVenda}

        <!-- Itens -->
        <tr>
          <td style="padding:0 32px 24px;">
            <h3 style="margin:0 0 12px;color:#1a1a1a;font-size:15px;font-weight:600;border-bottom:2px solid #e63946;padding-bottom:8px;">Itens do Pedido</h3>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <th style="text-align:left;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Produto</th>
                <th style="text-align:center;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Qtd</th>
                <th style="text-align:right;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Valor</th>
              </tr>
              ${itensHtml}
            </table>
          </td>
        </tr>

        <!-- Totais -->
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;">Subtotal</td>
                <td style="color:#333;font-size:14px;padding:4px 0;text-align:right;">${formatPrice(subtotal)}</td>
              </tr>
              <tr>
                <td style="color:#555;font-size:14px;padding:4px 0;">${opts.canecaEventoPirelli ? 'Retirada no evento' : `Frete${transportadoraTexto} ${prazoTexto}`}</td>
                <td style="color:#333;font-size:14px;padding:4px 0;text-align:right;">${opts.canecaEventoPirelli ? 'Incluída' : frete === 0 ? 'Grátis' : formatPrice(frete)}</td>
              </tr>
              <tr>
                <td style="border-top:2px solid #e63946;padding-top:10px;margin-top:8px;color:#1a1a1a;font-size:16px;font-weight:700;">Total</td>
                <td style="border-top:2px solid #e63946;padding-top:10px;color:#e63946;font-size:18px;font-weight:700;text-align:right;">${formatPrice(total)}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Próximos passos -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#f8f9fa;border-radius:6px;padding:20px;">
              <h3 style="margin:0 0 12px;color:#1a1a1a;font-size:14px;font-weight:700;">📦 Próximos passos</h3>
              ${proximosPassos}
            </div>
          </td>
        </tr>

        <!-- Contato -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <p style="color:#777;font-size:13px;margin:0 0 8px;">Dúvidas? Entre em contato:</p>
            <a href="https://wa.me/5519974049445" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;">💬 Falar no WhatsApp</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#999;font-size:12px;">Forza Motos — Campinas/SP | (19) 3254-0547 | forzamotos.com.br</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── E-mail de confirmação de ingresso ───────────────────────────────────────

export function htmlIngressoConfirmado(opts: {
  nomeCliente: string
  tituloEvento: string
  dataEvento: string
  localEvento: string
  quantidade: number
  total: number
}) {
  const { nomeCliente, tituloEvento, dataEvento, localEvento, quantidade, total } = opts

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#e63946;padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FORZA MOTOS</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Eventos & Experiências</p>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 16px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🎟️</div>
            <h2 style="color:#1a1a1a;margin:0 0 8px;font-size:22px;font-weight:700;">Ingresso Confirmado!</h2>
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! Seu ingresso foi confirmado com sucesso.</p>
          </td>
        </tr>

        <!-- Detalhes do evento -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <div style="background:#fff8f0;border:1px solid #ffe0b2;border-left:4px solid #e63946;border-radius:6px;padding:20px;">
              <h3 style="margin:0 0 16px;color:#e63946;font-size:16px;font-weight:700;">🏁 ${tituloEvento}</h3>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#777;font-size:13px;padding:4px 0;width:40%;">📅 Data</td>
                  <td style="color:#1a1a1a;font-size:13px;font-weight:600;padding:4px 0;">${dataEvento}</td>
                </tr>
                <tr>
                  <td style="color:#777;font-size:13px;padding:4px 0;">📍 Local</td>
                  <td style="color:#1a1a1a;font-size:13px;font-weight:600;padding:4px 0;">${localEvento}</td>
                </tr>
                <tr>
                  <td style="color:#777;font-size:13px;padding:4px 0;">🎟️ Ingressos</td>
                  <td style="color:#1a1a1a;font-size:13px;font-weight:600;padding:4px 0;">${quantidade} ingresso${quantidade > 1 ? 's' : ''}</td>
                </tr>
                <tr>
                  <td style="color:#777;font-size:13px;padding:4px 0;border-top:1px solid #ffe0b2;padding-top:12px;margin-top:8px;">💰 Total pago</td>
                  <td style="color:#e63946;font-size:16px;font-weight:700;padding:4px 0;border-top:1px solid #ffe0b2;">${formatPrice(total)}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- Informações -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#f8f9fa;border-radius:6px;padding:20px;">
              <h3 style="margin:0 0 12px;color:#1a1a1a;font-size:14px;font-weight:700;">ℹ️ Informações importantes</h3>
              <p style="margin:0 0 8px;color:#555;font-size:13px;">• Guarde este e-mail como comprovante de inscrição</p>
              <p style="margin:0 0 8px;color:#555;font-size:13px;">• Apresente o e-mail ou CPF na entrada do evento</p>
              <p style="margin:0;color:#555;font-size:13px;">• Em breve entraremos em contato com mais detalhes</p>
            </div>
          </td>
        </tr>

        <!-- Contato -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <p style="color:#777;font-size:13px;margin:0 0 8px;">Dúvidas sobre o evento?</p>
            <a href="https://wa.me/5519974049445" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;">💬 Falar no WhatsApp</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#999;font-size:12px;">Forza Motos — Campinas/SP | (19) 3254-0547 | forzamotos.com.br</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── NF-e autorizada ────────────────────────────────────────────────────────

export function htmlNfeAutorizada(opts: {
  nomeCliente: string
  numeroPedido: string
  chaveNfe: string
  danfeUrl?: string | null
  xmlAnexado?: boolean
}) {
  const nomeCliente = escaparHtml(opts.nomeCliente)
  const numeroPedido = escaparHtml(opts.numeroPedido)
  const chaveNfe = escaparHtml(opts.chaveNfe.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forzamotos.com.br'
  const pedidoUrl = `${baseUrl}/rastrear?pedido=${encodeURIComponent(opts.numeroPedido)}`
  let danfeUrl: string | null = null
  try {
    const url = new URL(opts.danfeUrl ?? '')
    if (url.protocol === 'https:' && url.hostname === 'erp.olist.com' &&
      !url.username && !url.password && (!url.port || url.port === '443')) {
      danfeUrl = url.href
    }
  } catch {
    danfeUrl = null
  }
  const botaoDanfe = danfeUrl
    ? `<a href="${danfeUrl}" style="display:inline-block;background:#e63946;color:#fff;text-decoration:none;padding:11px 24px;border-radius:20px;font-size:13px;font-weight:600;">Abrir DANFE →</a>`
    : `<a href="${pedidoUrl}" style="display:inline-block;background:#e63946;color:#fff;text-decoration:none;padding:11px 24px;border-radius:20px;font-size:13px;font-weight:600;">Acompanhar pedido →</a>`
  const textoAnexo = opts.xmlAnexado
    ? 'O arquivo XML oficial da NF-e está anexado a este e-mail.'
    : 'A chave de acesso da NF-e está disponível abaixo.'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#e63946;padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FORZA MOTOS</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Pneus e Peças para Moto</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 16px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🧾</div>
            <h2 style="color:#1a1a1a;margin:0 0 8px;font-size:22px;font-weight:700;">Sua nota fiscal foi emitida</h2>
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! A NF-e do pedido <strong>#${numeroPedido}</strong> foi autorizada.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;">
            <div style="background:#fff8f0;border:1px solid #ffe0b2;border-radius:6px;padding:20px;text-align:center;">
              <p style="margin:0 0 8px;color:#555;font-size:13px;">${textoAnexo}</p>
              <p style="margin:0 0 6px;color:#777;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Chave de acesso</p>
              <p style="margin:0 0 16px;color:#1a1a1a;font-size:13px;font-weight:700;font-family:monospace;line-height:1.7;word-break:break-word;">${chaveNfe}</p>
              ${botaoDanfe}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <p style="color:#777;font-size:13px;margin:0 0 8px;">Dúvidas sobre a compra?</p>
            <a href="https://wa.me/5519974049445" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;">💬 Falar no WhatsApp</a>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#999;font-size:12px;">Forza Motos — Campinas/SP | (19) 3254-0547 | forzamotos.com.br</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── E-mail de rastreio / pedido enviado ───────────────────────────────────

export function htmlPedidoEnviado(opts: {
  nomeCliente: string
  numeroPedido: string
  rastreio: string
  transportadora: string
  prazo?: number | null
}) {
  const nomeCliente = escaparHtml(opts.nomeCliente)
  const numeroPedido = escaparHtml(opts.numeroPedido)
  const rastreio = escaparHtml(opts.rastreio)
  const transportadora = escaparHtml(opts.transportadora)
  const prazo = opts.prazo
  const prazoTexto = prazo ? `Prazo estimado: <strong>${prazo} dias úteis</strong>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#e63946;padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FORZA MOTOS</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Pneus e Peças para Moto</p>
          </td>
        </tr>

        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 16px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🚚</div>
            <h2 style="color:#1a1a1a;margin:0 0 8px;font-size:22px;font-weight:700;">Seu pedido foi enviado!</h2>
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! Seu pedido <strong>#${numeroPedido}</strong> foi despachado e está a caminho.</p>
          </td>
        </tr>

        <!-- Rastreio -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:20px;text-align:center;">
              <p style="margin:0 0 4px;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Código de Rastreio</p>
              <p style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;font-family:monospace;letter-spacing:2px;">${rastreio}</p>
              <p style="margin:0 0 12px;color:#555;font-size:13px;">${transportadora} ${prazoTexto ? '— ' + prazoTexto : ''}</p>
              <a href="https://www.linkcorreios.com.br/?id=${encodeURIComponent(opts.rastreio)}" style="display:inline-block;background:#e63946;color:#fff;text-decoration:none;padding:10px 24px;border-radius:20px;font-size:13px;font-weight:600;">Rastrear Pedido →</a>
            </div>
          </td>
        </tr>

        <!-- Dica -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#f8f9fa;border-radius:6px;padding:16px;">
              <p style="margin:0;color:#555;font-size:13px;">💡 <strong>Dica:</strong> Você também pode rastrear diretamente no site dos Correios em <a href="https://rastreamento.correios.com.br" style="color:#e63946;">rastreamento.correios.com.br</a> ou pelo site da transportadora.</p>
            </div>
          </td>
        </tr>

        <!-- Contato -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <p style="color:#777;font-size:13px;margin:0 0 8px;">Alguma dúvida sobre a entrega?</p>
            <a href="https://wa.me/5519974049445" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;">💬 Falar no WhatsApp</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#999;font-size:12px;">Forza Motos — Campinas/SP | (19) 3254-0547 | forzamotos.com.br</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Pedido entregue ────────────────────────────────────────────────────────

export function htmlPedidoEntregue(opts: {
  nomeCliente: string
  numeroPedido: string
  rastreio?: string | null
  transportadora?: string | null
}) {
  const nomeCliente = escaparHtml(opts.nomeCliente)
  const numeroPedido = escaparHtml(opts.numeroPedido)
  const rastreio = opts.rastreio ? escaparHtml(opts.rastreio) : null
  const transportadora = opts.transportadora ? escaparHtml(opts.transportadora) : null
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://forzamotos.com.br'
  const pedidoUrl = `${baseUrl}/rastrear?pedido=${encodeURIComponent(opts.numeroPedido)}`
  const detalhe = rastreio || transportadora
    ? `<p style="margin:10px 0 0;color:#555;font-size:13px;">${transportadora ? `Transportadora: <strong>${transportadora}</strong>` : ''}${transportadora && rastreio ? '<br>' : ''}${rastreio ? `Rastreio: <strong style="font-family:monospace;">${rastreio}</strong>` : ''}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <tr>
          <td style="background:#e63946;padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FORZA MOTOS</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Pneus e Peças para Moto</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 16px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">📦</div>
            <h2 style="color:#1a1a1a;margin:0 0 8px;font-size:22px;font-weight:700;">Pedido entregue!</h2>
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! A transportadora confirmou a entrega do pedido <strong>#${numeroPedido}</strong>.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;">
            <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:20px;text-align:center;">
              <p style="margin:0;color:#2e7d32;font-size:15px;font-weight:700;">Entrega concluída com sucesso</p>
              ${detalhe}
              <div style="margin-top:16px;">
                <a href="${pedidoUrl}" style="display:inline-block;background:#e63946;color:#fff;text-decoration:none;padding:10px 24px;border-radius:20px;font-size:13px;font-weight:600;">Ver detalhes do pedido →</a>
              </div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#f8f9fa;border-radius:6px;padding:16px;">
              <p style="margin:0;color:#555;font-size:13px;">Se você não recebeu o pacote ou percebeu qualquer problema, fale com a nossa equipe para que possamos ajudar.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <a href="https://wa.me/5519974049445" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;">💬 Falar no WhatsApp</a>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#999;font-size:12px;">Forza Motos — Campinas/SP | (19) 3254-0547 | forzamotos.com.br</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function htmlPedidoProntoRetirada(opts: {
  nomeCliente: string
  numeroPedido: string
}) {
  const { nomeCliente, numeroPedido } = opts
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="background:#e63946;padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">FORZA MOTOS</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Pneus e Peças para Moto</p>
          </td>
        </tr>
        <!-- Hero -->
        <tr>
          <td style="padding:32px 32px 16px;text-align:center;">
            <div style="font-size:48px;margin-bottom:12px;">🏁</div>
            <h2 style="color:#1a1a1a;margin:0 0 8px;font-size:22px;font-weight:700;">Pronto para Retirada!</h2>
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! Seu pedido já está separado e aguardando você para retirada no nosso balcão.</p>
          </td>
        </tr>
        <!-- Número do pedido -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#fff8f0;border:1px solid #ffe0b2;border-radius:6px;padding:16px;text-align:center;">
              <p style="margin:0;color:#777;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Número do Pedido</p>
              <p style="margin:4px 0 0;color:#e63946;font-size:22px;font-weight:700;font-family:monospace;">${numeroPedido}</p>
            </div>
          </td>
        </tr>
        <!-- Informações de Retirada -->
        <tr>
          <td style="padding:0 32px 24px;">
            <div style="background:#f8f9fa;border-radius:6px;padding:20px;">
              <h3 style="margin:0 0 12px;color:#1a1a1a;font-size:14px;font-weight:700;">📍 Onde retirar:</h3>
              <p style="margin:0 0 8px;color:#333;font-size:13px;font-weight:600;">Forza Campinas</p>
              <p style="margin:0 0 12px;color:#555;font-size:13px;">Rua Funilense, 110 — Guanabara<br>Campinas/SP — CEP: 13073-041</p>
              <h3 style="margin:0 0 8px;color:#1a1a1a;font-size:14px;font-weight:700;">⏰ Horários:</h3>
              <p style="margin:0 0 4px;color:#555;font-size:13px;">• Segunda a Sexta: 9h às 18h</p>
              <p style="margin:0;color:#555;font-size:13px;">• Sábado: 8h às 12h</p>
            </div>
          </td>
        </tr>
        <!-- Contato -->
        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <p style="color:#777;font-size:13px;margin:0 0 8px;">Dúvidas? Fale conosco:</p>
            <a href="https://wa.me/5519974049445" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:20px;font-size:13px;font-weight:600;">💬 Chamar no WhatsApp</a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f5f5f5;padding:20px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#999;font-size:12px;">Forza Motos — Campinas/SP | (19) 3254-0547 | forzamotos.com.br</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Código de recuperação do Evento Pirelli ─────────────────────────────────

export function htmlCodigoRecuperacaoEventoPirelli(codigo: string) {
  // O chamador aceita somente seis dígitos; esta validação mantém o helper
  // seguro mesmo se ele for reutilizado fora da rota atual.
  if (!/^\d{6}$/.test(codigo)) throw new Error('Código de recuperação inválido.')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:560px;width:100%;">
        <tr>
          <td style="background:#e63946;padding:24px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;font-weight:700;">FORZA MOTOS</h1>
            <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px;">Evento Pirelli</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;text-align:center;">
            <h2 style="color:#1a1a1a;margin:0 0 12px;font-size:22px;">Recupere seu acesso</h2>
            <p style="color:#555;margin:0 0 22px;font-size:15px;line-height:1.5;">Use o código abaixo na página do evento:</p>
            <div style="background:#fff8f0;border:1px solid #ffe0b2;border-radius:8px;padding:18px;">
              <p style="margin:0;color:#e63946;font-family:monospace;font-size:30px;font-weight:700;letter-spacing:8px;">${codigo}</p>
            </div>
            <p style="color:#555;margin:22px 0 0;font-size:13px;line-height:1.5;">Este código vale por 10 minutos e pode ser usado uma única vez. Não compartilhe com ninguém.</p>
            <p style="color:#888;margin:12px 0 0;font-size:12px;line-height:1.5;">Se você não solicitou a recuperação, ignore este e-mail.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f5f5f5;padding:18px 32px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="margin:0;color:#999;font-size:12px;">Forza Motos — Campinas/SP</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
