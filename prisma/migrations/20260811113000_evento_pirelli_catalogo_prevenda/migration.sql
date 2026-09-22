-- Catálogo de pré-venda exclusivo da ação Pirelli.
-- Reutiliza Product/Order e a máquina financeira já auditada; os campos
-- adicionais identificam a campanha e preservam a promessa logística.

ALTER TYPE "CanalVenda" ADD VALUE IF NOT EXISTS 'EVENTO_PIRELLI';

ALTER TABLE "Product"
  ADD COLUMN "eventoPirelliId" TEXT,
  ADD COLUMN "ordemEvento" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "limitePorPedidoEvento" INTEGER;

ALTER TABLE "Order"
  ADD COLUMN "eventoPirelliId" TEXT;

ALTER TABLE "OrderItem"
  ADD COLUMN "preVendaSnapshot" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "prazoEntregaDiasSnapshot" INTEGER;

-- Pedidos de pré-venda que já existam passam a carregar o snapshot correto.
UPDATE "OrderItem" AS item
SET
  "preVendaSnapshot" = product."preVenda",
  "prazoEntregaDiasSnapshot" = product."prazoEntregaDias"
FROM "Product" AS product
WHERE product."id" = item."productId";

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_eventoPirelliId_fkey"
  FOREIGN KEY ("eventoPirelliId") REFERENCES "EventoPirelli"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Product_ordemEvento_check"
  CHECK ("ordemEvento" >= 0),
  ADD CONSTRAINT "Product_limitePorPedidoEvento_check"
  CHECK ("limitePorPedidoEvento" IS NULL OR "limitePorPedidoEvento" BETWEEN 1 AND 100),
  ADD CONSTRAINT "Product_eventoPirelli_prevenda_check"
  CHECK (
    "eventoPirelliId" IS NULL
    OR (
      "preVenda" = true
      AND "prazoEntregaDias" BETWEEN 1 AND 365
      AND "precoPromocional" IS NOT NULL
      AND "precoPromocional" > 0
      AND "precoPromocional" <= "preco"
    )
  );

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_eventoPirelliId_fkey"
  FOREIGN KEY ("eventoPirelliId") REFERENCES "EventoPirelli"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Product_eventoPirelliId_ativo_ordemEvento_idx"
  ON "Product"("eventoPirelliId", "ativo", "ordemEvento");

CREATE INDEX "Order_eventoPirelliId_status_createdAt_idx"
  ON "Order"("eventoPirelliId", "status", "createdAt");

-- PostgreSQL não cria índices para FKs automaticamente. Estes caminhos são
-- usados por pedido, webhook e retenção do histórico.
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX IF NOT EXISTS "OrderTracking_orderId_createdAt_idx"
  ON "OrderTracking"("orderId", "createdAt");
