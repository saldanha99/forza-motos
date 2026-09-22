-- Outboxes transacionais para confirmações de compra. Chaves únicas
-- eliminam duplicações; leases curtas recuperam workers interrompidos.

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "notificacoesAgendadasEm" TIMESTAMP(3);

-- Não envie confirmações antigas no primeiro cron depois do deploy.
UPDATE "Order"
SET "notificacoesAgendadasEm" = COALESCE("updatedAt", CURRENT_TIMESTAMP)
WHERE "status" IN ('CONFIRMADO', 'SEPARANDO', 'ENVIADO', 'ENTREGUE')
  AND "notificacoesAgendadasEm" IS NULL;

ALTER TABLE "CrmMensagem"
  ADD COLUMN IF NOT EXISTS "chaveIdempotencia" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiraEm" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmMensagem_chaveIdempotencia_key"
  ON "CrmMensagem"("chaveIdempotencia");
CREATE INDEX IF NOT EXISTS "CrmMensagem_status_leaseExpiraEm_idx"
  ON "CrmMensagem"("status", "leaseExpiraEm");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailOutboxTipo') THEN
    CREATE TYPE "EmailOutboxTipo" AS ENUM ('PEDIDO_CONFIRMADO', 'INGRESSO_CONFIRMADO');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailOutboxStatus') THEN
    CREATE TYPE "EmailOutboxStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHA');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EmailOutbox" (
  "id" TEXT NOT NULL,
  "chaveIdempotencia" TEXT NOT NULL,
  "tipo" "EmailOutboxTipo" NOT NULL,
  "destinatario" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "EmailOutboxStatus" NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "erro" TEXT,
  "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leaseExpiraEm" TIMESTAMP(3),
  "providerId" TEXT,
  "enviadaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailOutbox_chaveIdempotencia_key"
  ON "EmailOutbox"("chaveIdempotencia");
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_proximaTentativaEm_idx"
  ON "EmailOutbox"("status", "proximaTentativaEm");
CREATE INDEX IF NOT EXISTS "EmailOutbox_status_leaseExpiraEm_idx"
  ON "EmailOutbox"("status", "leaseExpiraEm");
