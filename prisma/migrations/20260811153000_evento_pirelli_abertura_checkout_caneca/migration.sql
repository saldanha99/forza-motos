-- Abertura antecipada controlada e vínculo financeiro participante ↔ pedido.
-- As datas físicas do evento permanecem intactas; dataFim ainda fecha a ação.

ALTER TABLE "EventoPirelli"
  ADD COLUMN "inscricoesAntecipadasAbertas" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "vendasAntecipadasAbertas" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order"
  ADD COLUMN "eventoPirelliVisitanteId" TEXT;

ALTER TABLE "EventoPirelliCompraCaneca"
  ADD COLUMN "orderId" TEXT;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_eventoPirelliVisitanteId_fkey"
  FOREIGN KEY ("eventoPirelliVisitanteId")
  REFERENCES "EventoPirelliVisitante"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Order_eventoPirelli_visitante_evento_check"
  CHECK ("eventoPirelliVisitanteId" IS NULL OR "eventoPirelliId" IS NOT NULL);

ALTER TABLE "EventoPirelliCompraCaneca"
  ADD CONSTRAINT "EventoPirelliCompraCaneca_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "EventoPirelliCompraCaneca_orderId_key"
  ON "EventoPirelliCompraCaneca"("orderId");

CREATE INDEX "Order_eventoPirelliVisitanteId_status_createdAt_idx"
  ON "Order"("eventoPirelliVisitanteId", "status", "createdAt");

-- Pedido explícito do responsável: inscrições e vendas abertas imediatamente.
UPDATE "EventoPirelli"
SET
  "inscricoesAntecipadasAbertas" = true,
  "vendasAntecipadasAbertas" = true,
  "updatedAt" = NOW()
WHERE "slug" = 'pirelli-forza';
