CREATE TYPE "EventoPirelliFormaPagamento" AS ENUM (
  'PIX_MERCADO_PAGO',
  'MERCADO_PAGO',
  'PIX_EXTERNO',
  'DINHEIRO',
  'CARTAO_CREDITO_MAQUININHA',
  'CARTAO_DEBITO_MAQUININHA',
  'OUTRO'
);

CREATE TYPE "EventoPirelliLancamentoCaixaTipo" AS ENUM (
  'VENDA_CANECA',
  'COMPRA_PNEUS'
);

CREATE TYPE "EventoPirelliLancamentoCaixaOrigem" AS ENUM (
  'CHECKOUT_MERCADO_PAGO',
  'ADMIN_PRESENCIAL'
);

ALTER TABLE "EventoPirelliCompraCaneca"
ADD COLUMN "formaPagamento" "EventoPirelliFormaPagamento",
ADD COLUMN "valorUnitarioSnapshot" DECIMAL(10,2),
ADD COLUMN "valorPago" DECIMAL(10,2),
ADD COLUMN "pagamentoConfirmadoEm" TIMESTAMP(3),
ADD COLUMN "pagamentoConfirmadoPor" TEXT,
ADD COLUMN "referenciaPagamento" TEXT;

ALTER TABLE "EventoPirelliElegibilidadeCaneca"
ADD COLUMN "formaPagamento" "EventoPirelliFormaPagamento",
ADD COLUMN "pagamentoConfirmadoEm" TIMESTAMP(3),
ADD COLUMN "pagamentoConfirmadoPor" TEXT,
ADD COLUMN "referenciaPagamento" TEXT;

-- Compras online antigas já passaram pela confirmação financeira do webhook,
-- mas não é seguro presumir que todas usaram Pix antes desta versão.
UPDATE "EventoPirelliCompraCaneca"
SET "formaPagamento" = 'MERCADO_PAGO',
    "valorPago" = "Order"."total",
    "pagamentoConfirmadoEm" = "EventoPirelliCompraCaneca"."registradoEm",
    "pagamentoConfirmadoPor" = 'Sistema - Mercado Pago'
FROM "Order"
WHERE "EventoPirelliCompraCaneca"."orderId" = "Order"."id";

-- O fluxo presencial antigo só criava a venda depois da conferência do caixa.
-- Preservamos essas linhas como pagas, marcando a origem como legado a revisar.
UPDATE "EventoPirelliCompraCaneca"
SET "formaPagamento" = 'OUTRO',
    "pagamentoConfirmadoEm" = "registradoEm",
    "pagamentoConfirmadoPor" = 'Cadastro presencial anterior',
    "referenciaPagamento" = "referenciaVenda"
WHERE "orderId" IS NULL;

CREATE TABLE "EventoPirelliLancamentoCaixa" (
  "id" TEXT NOT NULL,
  "eventoId" TEXT NOT NULL,
  "visitanteId" TEXT NOT NULL,
  "tipo" "EventoPirelliLancamentoCaixaTipo" NOT NULL,
  "origem" "EventoPirelliLancamentoCaixaOrigem" NOT NULL,
  "quantidade" INTEGER,
  "valorUnitario" DECIMAL(10,2),
  "valorTotal" DECIMAL(10,2) NOT NULL,
  "formaPagamento" "EventoPirelliFormaPagamento" NOT NULL,
  "referenciaPagamento" TEXT,
  "referenciaVenda" TEXT,
  "confirmadoEm" TIMESTAMP(3) NOT NULL,
  "confirmadoPor" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "observacao" TEXT,
  "estornadoEm" TIMESTAMP(3),
  "estornadoPor" TEXT,
  "estornoMotivo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoPirelliLancamentoCaixa_pkey" PRIMARY KEY ("id")
);

-- Reconstrói o histórico antigo de canecas para que o fechamento inicial não
-- comece zerado. Cada compra ganha uma chave derivada e não duplicável.
INSERT INTO "EventoPirelliLancamentoCaixa" (
  "id", "eventoId", "visitanteId", "tipo", "origem", "quantidade",
  "valorUnitario", "valorTotal", "formaPagamento", "referenciaPagamento",
  "referenciaVenda", "confirmadoEm", "confirmadoPor", "chaveIdempotencia",
  "observacao", "createdAt"
)
SELECT
  'cx_' || c."id", c."eventoId", c."visitanteId",
  'VENDA_CANECA'::"EventoPirelliLancamentoCaixaTipo",
  (CASE WHEN c."orderId" IS NULL THEN 'ADMIN_PRESENCIAL' ELSE 'CHECKOUT_MERCADO_PAGO' END)::"EventoPirelliLancamentoCaixaOrigem",
  c."quantidade", c."valorUnitarioSnapshot", c."valorPago", c."formaPagamento",
  c."referenciaPagamento", c."referenciaVenda", c."pagamentoConfirmadoEm",
  c."pagamentoConfirmadoPor", 'caneca:' || c."chaveIdempotencia",
  'Histórico migrado da venda de caneca.', c."registradoEm"
FROM "EventoPirelliCompraCaneca" c
WHERE c."visitanteId" IS NOT NULL
  AND c."valorPago" IS NOT NULL
  AND c."formaPagamento" IS NOT NULL
  AND c."pagamentoConfirmadoEm" IS NOT NULL
  AND c."pagamentoConfirmadoPor" IS NOT NULL;

ALTER TABLE "EventoPirelliCompraCaneca"
ADD CONSTRAINT "EventoPirelliCompraCaneca_valorUnitarioSnapshot_check"
CHECK ("valorUnitarioSnapshot" IS NULL OR "valorUnitarioSnapshot" > 0),
ADD CONSTRAINT "EventoPirelliCompraCaneca_valorPago_check"
CHECK ("valorPago" IS NULL OR "valorPago" > 0);

CREATE INDEX "EventoPirelliCompraCaneca_formaPagamento_pagamentoConfirmadoEm_idx"
ON "EventoPirelliCompraCaneca"("formaPagamento", "pagamentoConfirmadoEm");

CREATE INDEX "EventoPirelliElegibilidadeCaneca_formaPagamento_pagamentoConfirmadoEm_idx"
ON "EventoPirelliElegibilidadeCaneca"("formaPagamento", "pagamentoConfirmadoEm");

CREATE UNIQUE INDEX "EventoPirelliLancamentoCaixa_chaveIdempotencia_key"
ON "EventoPirelliLancamentoCaixa"("chaveIdempotencia");

CREATE INDEX "EventoPirelliLancamentoCaixa_eventoId_confirmadoEm_idx"
ON "EventoPirelliLancamentoCaixa"("eventoId", "confirmadoEm");

CREATE INDEX "EventoPirelliLancamentoCaixa_visitanteId_confirmadoEm_idx"
ON "EventoPirelliLancamentoCaixa"("visitanteId", "confirmadoEm");

CREATE INDEX "EventoPirelliLancamentoCaixa_eventoId_formaPagamento_confirmadoEm_idx"
ON "EventoPirelliLancamentoCaixa"("eventoId", "formaPagamento", "confirmadoEm");

ALTER TABLE "EventoPirelliLancamentoCaixa"
ADD CONSTRAINT "EventoPirelliLancamentoCaixa_eventoId_fkey"
FOREIGN KEY ("eventoId") REFERENCES "EventoPirelli"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "EventoPirelliLancamentoCaixa_visitanteId_fkey"
FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "EventoPirelliLancamentoCaixa_valorTotal_check"
CHECK ("valorTotal" > 0),
ADD CONSTRAINT "EventoPirelliLancamentoCaixa_quantidade_check"
CHECK ("quantidade" IS NULL OR "quantidade" > 0),
ADD CONSTRAINT "EventoPirelliLancamentoCaixa_valorUnitario_check"
CHECK ("valorUnitario" IS NULL OR "valorUnitario" > 0),
ADD CONSTRAINT "EventoPirelliLancamentoCaixa_referenciaPagamento_check"
CHECK (
  "formaPagamento" NOT IN ('PIX_EXTERNO', 'CARTAO_CREDITO_MAQUININHA', 'CARTAO_DEBITO_MAQUININHA')
  OR length(trim(COALESCE("referenciaPagamento", ''))) > 0
);
