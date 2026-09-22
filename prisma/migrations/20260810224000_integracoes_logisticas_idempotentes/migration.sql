-- Leases curtas para impedir chamadas externas duplicadas ao Olist e ao
-- Melhor Envio. Chamadas HTTP ficam fora de transações e leases vencidas
-- podem ser retomadas por uma reconciliação posterior.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "olistSyncStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "olistSyncExpiraEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "melhorEnvioSyncStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "melhorEnvioSyncExpiraEm" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Order_olistSyncStatus_olistSyncExpiraEm_idx"
  ON "Order"("olistSyncStatus", "olistSyncExpiraEm");
CREATE INDEX IF NOT EXISTS "Order_melhorEnvioSyncStatus_melhorEnvioSyncExpiraEm_idx"
  ON "Order"("melhorEnvioSyncStatus", "melhorEnvioSyncExpiraEm");
