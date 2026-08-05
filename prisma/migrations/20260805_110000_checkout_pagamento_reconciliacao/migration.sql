-- Prazo e desfecho da reserva local (expiração + trava de idempotência).
ALTER TABLE "Order" ADD COLUMN "reservaExpiraEm" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "reservaLiberadaEm" TIMESTAMP(3);

-- Pedidos pendentes herdados ganham um prazo; os demais já tiveram seu
-- desfecho, então nascem marcados como liberados (não compensam de novo).
UPDATE "Order"
SET "reservaExpiraEm" = "createdAt" + INTERVAL '60 minutes'
WHERE "status" = 'AGUARDANDO_PAGAMENTO' AND "reservaExpiraEm" IS NULL;

UPDATE "Order"
SET "reservaLiberadaEm" = COALESCE("updatedAt", "createdAt")
WHERE "status" <> 'AGUARDANDO_PAGAMENTO' AND "reservaLiberadaEm" IS NULL;

CREATE INDEX "Order_status_reservaExpiraEm_idx" ON "Order"("status", "reservaExpiraEm");

-- Tentativas de pagamento de uma mesma preferência.
CREATE TABLE "PagamentoTentativa" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metodo" TEXT,
    "valor" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagamentoTentativa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PagamentoTentativa_paymentId_key" ON "PagamentoTentativa"("paymentId");
CREATE INDEX "PagamentoTentativa_orderId_status_idx" ON "PagamentoTentativa"("orderId", "status");

ALTER TABLE "PagamentoTentativa"
  ADD CONSTRAINT "PagamentoTentativa_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Outbox de estorno.
CREATE TYPE "ReembolsoStatus" AS ENUM ('PENDENTE', 'CONCLUIDO', 'FALHOU');

CREATE TABLE "ReembolsoPagamento" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "status" "ReembolsoStatus" NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "ultimoErro" TEXT,
    "proximaTentativaEm" TIMESTAMP(3),
    "concluidoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReembolsoPagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReembolsoPagamento_paymentId_key" ON "ReembolsoPagamento"("paymentId");
CREATE INDEX "ReembolsoPagamento_status_proximaTentativaEm_idx" ON "ReembolsoPagamento"("status", "proximaTentativaEm");

ALTER TABLE "ReembolsoPagamento"
  ADD CONSTRAINT "ReembolsoPagamento_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
