ALTER TABLE "Order"
  ADD COLUMN "checkoutTentativaId" TEXT,
  ADD COLUMN "pagamentoResultadoIncerto" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cupomConsumido" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "OrderItem"
  ADD COLUMN "estoqueReservado" BOOLEAN NOT NULL DEFAULT true;

UPDATE "OrderItem" AS item
SET "estoqueReservado" = false
FROM "Product" AS product
WHERE item."productId" = product."id"
  AND product."preVenda" = true;

CREATE UNIQUE INDEX "Order_checkoutTentativaId_key" ON "Order"("checkoutTentativaId");
