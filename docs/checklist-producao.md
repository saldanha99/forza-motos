# Checklist de Produção — Sincronização Olist / Mercado Pago / Melhor Envio

Este documento cobre o que precisa ser configurado **fora do código** (painéis e
variáveis de ambiente) para a sincronização funcionar em produção.

## 1. Variáveis de ambiente (Vercel → Settings → Environment Variables)

| Variável | Obrigatória | Observação |
|---|---|---|
| `OLIST_TOKEN` | ✅ | Token da API v2 do Tiny/Olist |
| `MERCADOPAGO_ACCESS_TOKEN` | ✅ | Token de produção |
| `MERCADOPAGO_WEBHOOK_SECRET` | ✅ | Assinatura secreta do webhook (valida HMAC) |
| `MELHOR_ENVIO_TOKEN` | ✅ | Token de produção |
| `MELHOR_ENVIO_CEP_ORIGEM` | ✅ | CEP da loja/galpão |
| `MELHOR_ENVIO_URL` | ⚠️ | Sem ela usa produção por padrão; setar explicitamente |
| `CRON_SECRET` | ✅ | `openssl rand -hex 32` — protege os endpoints de cron |
| `OLIST_WEBHOOK_SECRET` | ➖ | Opcional — protege o webhook de entrada do Olist |
| `NEXTAUTH_URL` | ✅ | URL pública (usada nas back_urls e notification_url do MP) |

## 2. Webhook do Olist/Tiny → site (estoque/pedido em TEMPO REAL)

Sem isso, o estoque do Olist só atualiza no site **1x/dia** (cron das 6h).

1. Painel Olist/Tiny → **Configurações → API → Webhooks** (requer a extensão
   "API para estoque em tempo real").
2. Cadastre a URL:
   - Sem token: `https://SEU_DOMINIO/api/olist/webhook`
   - Com token: `https://SEU_DOMINIO/api/olist/webhook?secret=<OLIST_WEBHOOK_SECRET>`
3. Eventos a habilitar: **estoque**, **produto** e **pedido** (situação).

## 3. Webhook do Mercado Pago → site

1. Painel MP → **Suas integrações → Webhooks**.
2. URL: `https://SEU_DOMINIO/api/mercadopago/webhook`
3. Evento: **Pagamentos** (`payment`).
4. Copie a **Assinatura secreta** para `MERCADOPAGO_WEBHOOK_SECRET`.

## 4. Fluxo de estoque (como funciona após as correções)

- **Venda no site:** estoque local é debitado na criação (reserva) → ao aprovar
  o pagamento, o pedido é incluído no Olist (`pedido.incluir`) e o Olist dá baixa
  no depósito → a baixa volta ao site pelo webhook/cron de entrada.
- **Pagamento recusado/cancelado/expirado:** a reserva de estoque é devolvida
  automaticamente (`restaurarEstoquePedido`).
- **Confirmação do pagamento:** a re-checagem de estoque no Olist roda em modo
  *somente leitura* (`atualizarBanco:false`) para **não reverter a reserva**.
- **Rede de segurança:** o cron diário (`/api/olist/cron`) reprocessa pedidos
  pagos que não foram replicados (`replicarPedidosPendentes`). Também há o
  endpoint admin `POST /api/admin/pedidos/{id}/replicar-olist` para forçar manual.

## 5. CPF obrigatório

O Olist exige `cpf_cnpj` do cliente para emitir NF. O checkout agora coleta CPF
e ele é enviado em `pedido.cliente.cpf_cnpj`. Pedidos antigos sem CPF falham na
replicação (aparecem no tracking) — preencher o CPF do cliente e reprocessar.

## 6. Pendências conhecidas (não-bloqueantes)

- **API Tiny v2 em descontinuação gradual** pela Olist (migração futura para a
  API v3 OAuth2). Planejar migração.
- E-mail automático com código de rastreio (hoje só WhatsApp via Evolution).
