# Plano — Features grandes (reunião 20/07/2026)

Três features decididas com o Caio, planejadas para execução em branches separadas.
Ordem sugerida: **2 → 3 → 1** (Sorocaba tem data marcada; peças por moto/ano destrava venda cruzada; a IA depende de infra das outras duas).

---

## 1. IA de assessoria de agenda/estoque via WhatsApp

**Problema real:** produto com 1 unidade no estoque é "prometido" para um agendamento, mas o estoque não reflete a reserva — dois clientes podem agendar o mesmo pneu. O Caio quer um grupo de WhatsApp onde uma IA avisa: *"cliente X e Y querem o mesmo pneu, só tem 1"*.

**Infra existente que reaproveita:** Evolution API já integrada (`lib/evolution/` — client, queue, templates), agendamentos em `Appointment`, estoque sincronizado com Olist.

### Fase 1 — Reserva de estoque + alerta determinístico (sem IA) · ~2 dias
- Model `ReservaEstoque { id, appointmentId, productId, quantidade, status: ATIVA|CONSUMIDA|CANCELADA }`.
- No agendamento de troca de pneu/óleo/kit, o admin (ou o cliente, se escolher o produto) vincula o produto → cria reserva.
- Regra: `estoqueDisponivel = estoque - reservasAtivas`. Site passa a exibir/bloquear por disponível.
- Trigger no POST de agendamento: se `reservasAtivas + 1 > estoque` → mensagem no grupo de assessoria via Evolution API com os dois clientes e o produto.
- Config: `GRUPO_ASSESSORIA_JID` no env.

### Fase 2 — Resumo diário automático · ~0,5 dia
- Cron (já existe padrão de cron no projeto) às 8h: agenda do dia, agendamentos pendentes de confirmação, produtos com estoque ≤ reservas.

### Fase 3 — IA conversacional no grupo · ~3 dias
- Webhook de mensagens recebidas da Evolution API → Claude API com tool use: `consultarAgenda(data)`, `consultarEstoque(termo)`, `conflitosReserva()`.
- Responde perguntas do Caio no próprio grupo ("tem Angel GT 160 pra sábado?").
- Guard-rails: só responde no grupo autorizado, só leitura (nenhuma ação de escrita via IA na fase inicial).

---

## 2. Venda antecipada — evento de Sorocaba

**Problema real:** vender produtos da tabela Pirelli durante o evento **sem estoque físico**, com preço promocional (cupom) e entrega posterior (Brasil inteiro via Melhor Envio).

### Escopo · ~3 dias
1. **Pré-venda no produto** (~0,5 dia)
   - `Product.preVenda Boolean` + `Product.prazoEntregaDias Int?`.
   - Compra liberada com estoque 0 quando `preVenda` (bypass do bloqueio de estoque e da verificação Tiny no checkout).
   - Badge "Pré-venda · postagem em até X dias úteis" no card, página do produto e e-mail do pedido.
   - Produtos cadastrados manualmente (fora do Olist — o fluxo de produto manual já existe).
2. **Cupom de desconto** (~1,5 dia — não existe hoje)
   - Model `Cupom { codigo, tipo: PERCENTUAL|VALOR, valor, validadeAte, usoMaximo, usados, ativo, categoriaRestrita? }`.
   - Campo de cupom no checkout + validação server-side no cálculo do total (nunca confiar no cliente).
   - Admin simples em /admin/cupons (criar, desativar, ver usos).
3. **Landing do evento** (~1 dia)
   - `/sorocaba` (ou `/evento/[slug]` reutilizando o módulo de eventos): vitrine só dos produtos de pré-venda + cupom do evento em destaque + QR code para imprimir na banca.
   - Notebook na banca abre a landing; cliente compra no próprio celular pelo QR.

**Pergunta aberta p/ Caio:** os pedidos de pré-venda entram no Olist manualmente depois (quando a Pirelli faturar) ou ficam só no e-commerce? (Afeta a baixa de estoque futura.)

---

## 3. Busca de peças por moto/ano

**Problema real:** pastilha/filtro/óleo variam por moto **e por faixa de ano** (GS 1200 até 2012 ≠ 2013–2018 ≠ 2019+). O Caio sabe tudo de cabeça; o sistema precisa de um jeito rápido de ele registrar isso.

### Escopo · ~4 dias + curadoria contínua
1. **Modelo de dados** (~0,5 dia)
   - `Moto { id, marca, modelo, anoDe, anoAte?, slug }` — faixas de ano viram registros distintos.
   - `ProdutoMoto { productId, motoId }` (N:N). O Json `compatibilidadeMotos` atual vira legado/fallback.
2. **Admin de vinculação em massa** (~1,5 dia)
   - Tela "Compatibilidade": seleciona a moto → busca produtos → marca checkboxes → salva. Otimizada para o fluxo "sei de cabeça" do Caio (atalhos, duplicar vínculos de uma moto para outra).
   - Import CSV opcional (moto, sku) para carga inicial.
3. **Vitrine** (~1,5 dia)
   - `/moto/[slug]`: tudo que serve na moto, agrupado por categoria (pneus, pastilhas, filtros, óleo, kit).
   - Integração com a **busca por placa**: placa → identifica moto+ano (a API já retorna ano) → casa com registro `Moto` → "ver tudo para sua moto" (não só pneus). Resolve também a pergunta do cliente leigo sobre pastilha.
   - Seletor manual marca→modelo→ano para quem não tem a placa.
4. **SEO** (~0,5 dia)
   - Páginas `/moto/[slug]` no sitemap + schema.org — long-tail "pastilha de freio GS 1200 2015".

---

## Dependências e observações
- **2 antes de 3**: o cupom e a pré-venda são independentes do catálogo de motos.
- **3 alimenta 1**: com reserva vinculada a produto+moto, os alertas da IA ficam mais precisos.
- Todas as migrações seguem o fluxo atual (`prisma migrate deploy` no deploy.sh da VPS).
