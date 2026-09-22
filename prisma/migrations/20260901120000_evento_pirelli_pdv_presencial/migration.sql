CREATE TYPE "EventoPirelliVendaPresencialStatus" AS ENUM (
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'CANCELADO'
);

-- No PDV, o nome pode ser confirmado pelo próprio cliente depois do pagamento.
ALTER TABLE "EventoPirelliCompraCaneca"
  ALTER COLUMN "nomeGravacaoSnapshot" DROP NOT NULL;

CREATE TABLE "EventoPirelliVendaPresencial" (
  "id" TEXT NOT NULL,
  "eventoId" TEXT NOT NULL,
  "visitanteId" TEXT NOT NULL,
  "tipo" "EventoPirelliLancamentoCaixaTipo" NOT NULL,
  "status" "EventoPirelliVendaPresencialStatus" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
  "quantidade" INTEGER,
  "valorUnitario" DECIMAL(10,2),
  "valorTotal" DECIMAL(10,2) NOT NULL,
  "formaPagamento" "EventoPirelliFormaPagamento" NOT NULL,
  "referenciaPagamento" TEXT,
  "referenciaVenda" TEXT,
  "criadoPor" TEXT NOT NULL,
  "pagamentoConfirmadoEm" TIMESTAMP(3),
  "pagamentoConfirmadoPor" TEXT,
  "canceladoEm" TIMESTAMP(3),
  "canceladoPor" TEXT,
  "cancelamentoMotivo" TEXT,
  "chaveIdempotencia" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoPirelliVendaPresencial_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventoPirelliVendaPresencial_valores_check" CHECK (
    "valorTotal" > 0
    AND (
      ("tipo" = 'VENDA_CANECA' AND "quantidade" IS NOT NULL AND "quantidade" BETWEEN 1 AND 10 AND "valorUnitario" IS NOT NULL AND "valorUnitario" > 0)
      OR ("tipo" = 'COMPRA_PNEUS' AND "quantidade" IS NULL AND "valorUnitario" IS NULL)
    )
  ),
  CONSTRAINT "EventoPirelliVendaPresencial_status_check" CHECK (
    ("status" = 'AGUARDANDO_PAGAMENTO' AND "pagamentoConfirmadoEm" IS NULL AND "pagamentoConfirmadoPor" IS NULL AND "canceladoEm" IS NULL AND "canceladoPor" IS NULL)
    OR ("status" = 'PAGO' AND "pagamentoConfirmadoEm" IS NOT NULL AND "pagamentoConfirmadoPor" IS NOT NULL AND "canceladoEm" IS NULL AND "canceladoPor" IS NULL)
    OR ("status" = 'CANCELADO' AND "pagamentoConfirmadoEm" IS NULL AND "pagamentoConfirmadoPor" IS NULL AND "canceladoEm" IS NOT NULL AND "canceladoPor" IS NOT NULL)
  ),
  CONSTRAINT "EventoPirelliVendaPresencial_referencia_pagamento_check" CHECK (
    "status" <> 'PAGO'
    OR "formaPagamento" NOT IN ('PIX_EXTERNO', 'CARTAO_CREDITO_MAQUININHA', 'CARTAO_DEBITO_MAQUININHA')
    OR length(trim(COALESCE("referenciaPagamento", ''))) > 0
  )
);

CREATE UNIQUE INDEX "EventoPirelliVendaPresencial_chaveIdempotencia_key"
  ON "EventoPirelliVendaPresencial"("chaveIdempotencia");
CREATE INDEX "EventoPirelliVendaPresencial_eventoId_status_createdAt_idx"
  ON "EventoPirelliVendaPresencial"("eventoId", "status", "createdAt");
CREATE INDEX "EventoPirelliVendaPresencial_visitanteId_status_createdAt_idx"
  ON "EventoPirelliVendaPresencial"("visitanteId", "status", "createdAt");

ALTER TABLE "EventoPirelliVendaPresencial"
  ADD CONSTRAINT "EventoPirelliVendaPresencial_eventoId_fkey"
  FOREIGN KEY ("eventoId") REFERENCES "EventoPirelli"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventoPirelliVendaPresencial_visitanteId_fkey"
  FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
