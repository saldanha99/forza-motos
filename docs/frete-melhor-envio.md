# Frete via Melhor Envio — Guia de Setup

Documento para ativar a integração com Melhor Envio em produção.

## Passo 1 — Criar conta

1. Acesse https://melhorenvio.com.br
2. Cadastro grátis (CPF ou CNPJ)
3. Faça login → preencha dados da loja em **Configurações → Loja**

> Dica: cadastre o **CEP da loja física em Campinas/SP** como CEP de origem padrão.

## Passo 2 — Gerar token de API

1. No painel logado, vai em **Configurações → Tokens**
2. Clica em **Gerar token**
3. Dê um nome (ex: "Forza Motos Produção")
4. Marque as permissões:
   - `cart-read`
   - `cart-write`
   - `companies-read`
   - `coupons-read`
   - `notifications-read`
   - `orders-read`
   - `products-read`
   - `products-write`
   - `purchases-read`
   - `shipping-calculate`
   - `shipping-cancel`
   - `shipping-checkout`
   - `shipping-companies`
   - `shipping-generate`
   - `shipping-preview`
   - `shipping-print`
   - `shipping-share`
   - `shipping-tracking`
   - `ecommerce-shipping`
   - `transactions-read`
5. Salve e **copie o token** (só aparece uma vez!)

## Passo 3 — Configurar variáveis

No `.env.local` e no painel da Vercel adicione:

```bash
MELHOR_ENVIO_TOKEN=eyJ0eXAiOiJKV1Qi...  # cole o token aqui
MELHOR_ENVIO_URL=https://www.melhorenvio.com.br/api/v2
MELHOR_ENVIO_CEP_ORIGEM=13000000  # CEP da loja em Campinas
MELHOR_ENVIO_USER_AGENT=Forza Motos contato@forzamotos.com.br
```

⚠️ **Em testes use o sandbox primeiro:**
```bash
MELHOR_ENVIO_URL=https://sandbox.melhorenvio.com.br/api/v2
```

O sandbox usa um token separado — gere em https://sandbox.melhorenvio.com.br

## Passo 4 — Testar cotação

```bash
curl -X POST https://forza-motos-app.vercel.app/api/frete/cotar \
  -H "Content-Type: application/json" \
  -d '{
    "cepDestino": "01310100",
    "items": [
      { "productId": "id-de-um-produto-real", "quantidade": 2 }
    ],
    "valorTotal": 489.90
  }'
```

Resposta esperada:
```json
{
  "opcoes": [
    {
      "id": "1",
      "nome": "PAC",
      "transportadora": "Correios",
      "logo": "https://www.melhorenvio.com.br/images/shipping-companies/correios.png",
      "preco": 28.50,
      "prazo": 7,
      "fonte": "melhor-envio"
    },
    {
      "id": "2",
      "nome": "SEDEX",
      "transportadora": "Correios",
      "preco": 42.30,
      "prazo": 3,
      "fonte": "melhor-envio"
    },
    {
      "id": "3",
      "nome": ".Package",
      "transportadora": "Jadlog",
      "preco": 31.80,
      "prazo": 5,
      "fonte": "melhor-envio"
    }
  ]
}
```

Se `fonte` vier `"fallback"`, significa que a API do ME falhou e o sistema usou a tabela hardcoded — verifique o token e o CEP de origem.

## Passo 5 — Atualizar o checkout

No componente do checkout (em `app/(store)/checkout/page.tsx`), o radio de frete agora deve:

1. Chamar `POST /api/frete/cotar` ao detectar CEP completo
2. Mostrar as opções (com logo da transportadora)
3. Ao cliente escolher, gravar no estado:
   ```typescript
   {
     freteServico: opcao.id,
     freteTransportadora: opcao.transportadora,
     frete: opcao.preco,
     fretePrazo: opcao.prazo,
   }
   ```
4. Ao criar o pedido (`POST /api/pedidos`), enviar esses 4 campos

A rota `/api/pedidos` já está preparada — só falta atualizar o componente do checkout para chamar `/api/frete/cotar` e passar os campos novos.

## Sobre dimensões dos produtos

A cotação real precisa de **peso + altura + largura + comprimento** de cada produto. Existem 3 camadas de fallback:

1. **Banco** (campos `peso`, `altura`, `largura`, `comprimento` no Product)
2. **Sync do Olist** atualiza esses campos sempre que produto for sincronizado (`lib/olist/sync-products.ts`)
3. **Padrão por categoria** (`lib/frete/dimensoes.ts`) — usado quando produto não tem dimensões

Conforme você sincronizar produtos com o Olist, os campos do banco vão se preenchendo. Para forçar uma re-sync agora:

```bash
# Re-sincroniza um produto específico
curl -X POST https://forza-motos-app.vercel.app/api/admin/produtos/<id>/sync

# Re-sincroniza tudo (cron Olist diário)
# Já roda automaticamente às 06:00 UTC via vercel.json
```

## Etiqueta de envio

A skill **NÃO inclui** a compra automática da etiqueta — esse fluxo geralmente é manual no painel do Olist:

1. Pedido chega no Olist
2. Você marca como "Em separação"
3. Olist tem integração nativa com Melhor Envio: emite NF + cria etiqueta
4. Olist envia tracking code de volta → nosso webhook captura → atualiza `Order.trackingCode`

Se você quiser **automatizar a compra da etiqueta direto pelo site Forza** (sem passar pelo painel Olist), use a função `adicionarAoCarrinhoME()` em `lib/frete/melhor-envio.ts` — está pronta mas não está sendo chamada em lugar nenhum ainda.

## Custos

- **Cotação**: grátis (cota quantas vezes quiser)
- **Etiqueta**: você compra com saldo ME
  - PAC/SEDEX no ME costuma ser **10-30% mais barato** que balcão Correios
  - Jadlog/JeT no ME é igual ou mais barato que cotar direto com eles
- **Sem mensalidade**

Recarregue saldo em **Carteira → Adicionar crédito**. Mínimo R$ 10, paga via PIX.

## Troubleshooting

| Erro | Causa | Solução |
|---|---|---|
| `MELHOR_ENVIO_TOKEN não configurado` | env var ausente | Adicionar em `.env.local` + Vercel |
| `401 Unauthorized` | Token revogado ou inválido | Gerar novo token |
| `422 Unprocessable Entity` | Peso ou dimensão inválida (0 ou negativa) | Verificar campos do produto |
| `429 Too Many Requests` | Rate limit ME (10 req/s) | Adicionar cache no front (debounce de CEP) |
| `fonte: "fallback"` em todas as cotações | API ME inacessível | Verificar URL + token |

Documentação oficial: https://docs.melhorenvio.com.br
