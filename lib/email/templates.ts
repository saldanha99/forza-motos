import { formatPrice } from '@/lib/utils'

interface ItemEmail {
  nome: string
  quantidade: number
  precoUnitario: number | string
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
}) {
  const { nomeCliente, numeroPedido, itens, subtotal, frete, total, freteTransportadora, fretePrazo } = opts

  const itensHtml = itens
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#333; font-size:14px;">${i.nome}</td>
        <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#555; font-size:14px; text-align:center;">${i.quantidade}x</td>
        <td style="padding:10px 0; border-bottom:1px solid #f0f0f0; color:#333; font-size:14px; text-align:right;">${formatPrice(Number(i.precoUnitario) * i.quantidade)}</td>
      </tr>`,
    )
    .join('')

  const prazoTexto = fretePrazo ? `(prazo estimado: ${fretePrazo} dias úteis)` : ''
  const transportadoraTexto = freteTransportadora ? ` via ${freteTransportadora}` : ''

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
            <h2 style="color:#1a1a1a;margin:0 0 8px;font-size:22px;font-weight:700;">Pedido Confirmado!</h2>
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! Seu pagamento foi aprovado e já estamos separando seu pedido.</p>
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
                <td style="color:#555;font-size:14px;padding:4px 0;">Frete${transportadoraTexto} ${prazoTexto}</td>
                <td style="color:#333;font-size:14px;padding:4px 0;text-align:right;">${frete === 0 ? 'Grátis' : formatPrice(frete)}</td>
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
              <p style="margin:0 0 8px;color:#555;font-size:13px;">1. Estamos separando e embalando seu pedido</p>
              <p style="margin:0 0 8px;color:#555;font-size:13px;">2. Em breve você receberá o código de rastreio</p>
              <p style="margin:0;color:#555;font-size:13px;">3. Acompanhe seu pedido pelo link que enviaremos</p>
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

// ─── E-mail de rastreio / pedido enviado ───────────────────────────────────

export function htmlPedidoEnviado(opts: {
  nomeCliente: string
  numeroPedido: string
  rastreio: string
  transportadora: string
  prazo?: number | null
}) {
  const { nomeCliente, numeroPedido, rastreio, transportadora, prazo } = opts
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
            <p style="color:#555;margin:0;font-size:15px;">Olá, <strong>${nomeCliente}</strong>! Seu pedido <strong>#${numeroPedido}</strong> saiu para entrega.</p>
          </td>
        </tr>

        <!-- Rastreio -->
        <tr>
          <td style="padding:16px 32px 24px;">
            <div style="background:#e8f5e9;border:1px solid #a5d6a7;border-radius:6px;padding:20px;text-align:center;">
              <p style="margin:0 0 4px;color:#555;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Código de Rastreio</p>
              <p style="margin:0 0 8px;color:#1a1a1a;font-size:22px;font-weight:700;font-family:monospace;letter-spacing:2px;">${rastreio}</p>
              <p style="margin:0 0 12px;color:#555;font-size:13px;">${transportadora} ${prazoTexto ? '— ' + prazoTexto : ''}</p>
              <a href="https://www.linkcorreios.com.br/?id=${rastreio}" style="display:inline-block;background:#e63946;color:#fff;text-decoration:none;padding:10px 24px;border-radius:20px;font-size:13px;font-weight:600;">Rastrear Pedido →</a>
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
