# Fluxo Pedido → Pagamento → Olist → Entrega

Documentação do ciclo completo de uma venda no Forza Motos.

## Diagrama do fluxo

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENTE NO CHECKOUT (forza-motos-app.vercel.app/checkout)  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Digita CEP
                     ▼
        ┌──────────────────────────────────┐
        │ POST /api/frete/cotar            │
        │ → lib/frete/cotar.ts             │
        │   → Melhor Envio (PAC, SEDEX,    │
        │     Jadlog, JeT, etc)            │
        │   → Fallback se ME falhar        │
        └────────────────┬─────────────────┘
                         │
                         │ Cliente escolhe (ex: Jadlog R$ 28,50)
                         ▼
        ┌──────────────────────────────────┐
        │ POST /api/pedidos                │
        │   - Cria Order status =          │
        │     AGUARDANDO_PAGAMENTO         │
        │   - Salva freteServico,          │
        │     freteTransportadora, frete   │
        │   - Debita estoque               │
        │   - Cria preferência Mercado Pago│
        │   ⚠️ NÃO cria no Olist ainda     │
        └────────────────┬─────────────────┘
                         │
                         │ Redireciona → Checkout Pro MP
                         ▼
        ┌──────────────────────────────────┐
        │  CLIENTE PAGA NO MERCADO PAGO    │
        │  (Cartão / PIX / Boleto)         │
        └────────────────┬─────────────────┘
                         │
                         │ MP envia webhook
                         ▼
        ┌──────────────────────────────────┐
        │ POST /api/mercadopago/webhook    │
        │   status: approved               │
        │   1. Update Order.status =       │
        │      CONFIRMADO                  │
        │   2. ✨ Replica pedido no Olist  │
        │      (idempotente — só se        │
        │      olistOrderId for null)      │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  OLIST (painel administrativo)   │
        │   - Recebe pedido pago           │
        │   - Emite NF                     │
        │   - Integração nativa com        │
        │     Melhor Envio → etiqueta      │
        │   - Marca como "Enviado" +       │
        │     adiciona código de rastreio  │
        └────────────────┬─────────────────┘
                         │
                         │ Olist envia webhook
                         ▼
        ┌──────────────────────────────────┐
        │ POST /api/olist/webhook          │
        │   evento: order.updated          │
        │   1. Update Order.status =       │
        │      ENVIADO                     │
        │   2. ✨ Captura tracking_code    │
        │      → salva em Order.trackingCode│
        │   3. Cria OrderTracking          │
        └────────────────┬─────────────────┘
                         │
                         ▼
        ┌──────────────────────────────────┐
        │  CLIENTE acompanha em /rastrear  │
        │  vê código + status atualizado   │
        └──────────────────────────────────┘
```

## Decisões arquiteturais importantes

### 1. Pedido só vai pro Olist APÓS pagamento aprovado

**Antes:** o pedido era replicado no `POST /api/pedidos` (mesmo em AGUARDANDO_PAGAMENTO).

**Agora:** só replica no webhook MP quando `status === 'approved'`.

**Por quê:**
- Olist com automação de NF não emite nota fiscal de pedido não pago
- Não polui o painel do Olist com pedidos que nunca vão se concretizar (PIX vencido, boleto não pago)
- Idempotência garantida: verifica `olistOrderId` antes de replicar

### 2. Idempotência em ambos os webhooks

Tanto MP quanto Olist podem reenviar webhooks (políticas de retry deles). Por isso:

- **MP webhook**: verifica `order.status !== 'CONFIRMADO'` antes de atualizar; verifica `!order.olistOrderId` antes de replicar
- **Olist webhook**: verifica `pedido.status !== novoStatus` antes de atualizar; verifica `!pedido.trackingCode` antes de salvar rastreio

Resultado: webhooks podem ser disparados 10 vezes e o resultado fica igual à 1ª vez.

### 3. Captura de tracking code

O webhook do Olist tenta capturar o código de rastreio de **6 chaves possíveis** no payload:

```typescript
const trackingCode =
  body.dados?.codigo_rastreamento ||
  body.dados?.rastreamento?.codigo ||
  body.dados?.objeto_correios ||
  body.data?.tracking_code ||
  body.data?.tracking?.code
```

Isso porque o Tiny/Olist tem APIs antigas (PT) e novas (EN) que mudaram nomes ao longo do tempo. Se você descobrir uma nova chave, adicione na lista.

### 4. Sincronização de dimensões dos produtos

A cotação do Melhor Envio precisa de peso + dimensões. O fluxo é:

1. Cron diário do Olist (06:00 UTC) sincroniza produtos com `lib/olist/sync-products.ts`
2. O `mapearListagem()` agora extrai peso/altura/largura/comprimento do payload Tiny
3. Salva no banco (Product.peso, Product.altura, etc)
4. Quando o cliente cota frete, `lib/frete/cotar.ts` busca esses campos
5. Se produto não tem dimensões (produto antigo ainda não re-sincronizado), usa fallback por categoria em `lib/frete/dimensoes.ts`

Conforme os produtos forem sincronizando, o fallback fica obsoleto.

## Campos novos no schema

### `Product`
```prisma
peso          Decimal? @db.Decimal(8, 3)  // kg
altura        Decimal? @db.Decimal(8, 2)  // cm
largura       Decimal? @db.Decimal(8, 2)  // cm
comprimento   Decimal? @db.Decimal(8, 2)  // cm
```

### `Order`
```prisma
freteServico         String?  // ID do serviço Melhor Envio (ex: "1", "2", "8")
freteTransportadora  String?  // "Correios", "Jadlog", "Total Express"
fretePrazo           Int?     // dias úteis
trackingCode         String?  // código de rastreio (preenchido após envio)
```

## Rota nova

### `POST /api/frete/cotar`

Cota opções de frete em tempo real. Não exige autenticação (usado no checkout público).

Veja `docs/frete-melhor-envio.md` para detalhes de payload e setup.

## Próximas integrações recomendadas

| Item | Prioridade | Comentário |
|---|---|---|
| Atualizar UI do checkout pra cotar via `/api/frete/cotar` | 🔴 Alta | Sem isso a integração não tem efeito visível ao cliente |
| Cron de "retry" para pedidos não replicados no Olist | 🟡 Média | Pega casos onde a replicação falhou silenciosamente |
| Endpoint admin `/api/admin/pedidos/{id}/replicar-olist` | 🟡 Média | Botão pra forçar replicação manual quando algo dá errado |
| Email automático ao cliente com tracking code | 🟢 Baixa | Quando trackingCode for setado, dispara email |
| Página `/rastrear?codigo=ABC` puxar status real do Correios/Jadlog | 🟢 Baixa | API pública dos Correios tem rate limit |
