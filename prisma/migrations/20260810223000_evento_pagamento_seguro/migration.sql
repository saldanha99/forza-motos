-- Reserva de vagas, idempotência e rastreabilidade do pagamento de eventos.
ALTER TABLE "EventoInscricao"
  ADD COLUMN IF NOT EXISTS "checkoutTentativaId" TEXT,
  ADD COLUMN IF NOT EXISTS "consultaToken" TEXT,
  ADD COLUMN IF NOT EXISTS "reservaExpiraEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mpStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "pagamentoResultadoIncerto" BOOLEAN NOT NULL DEFAULT false;

-- Inscrições pendentes herdadas ocupam a vaga por no máximo uma hora.
UPDATE "EventoInscricao"
SET "reservaExpiraEm" = "createdAt" + INTERVAL '60 minutes'
WHERE "status" = 'PENDENTE'
  AND "reservaExpiraEm" IS NULL;

-- Links antigos também recebem um identificador opaco. Não derivamos o token
-- do id público da inscrição; isso evita enumeração de dados de participantes.
UPDATE "EventoInscricao"
SET "consultaToken" =
  md5(random()::text || clock_timestamp()::text || "id") ||
  substring(md5("id" || random()::text || clock_timestamp()::text), 1, 16)
WHERE "consultaToken" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "EventoInscricao_mpPagamentoId_key"
  ON "EventoInscricao"("mpPagamentoId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventoInscricao_checkoutTentativaId_key"
  ON "EventoInscricao"("checkoutTentativaId");
CREATE UNIQUE INDEX IF NOT EXISTS "EventoInscricao_consultaToken_key"
  ON "EventoInscricao"("consultaToken");
CREATE INDEX IF NOT EXISTS "EventoInscricao_status_reservaExpiraEm_idx"
  ON "EventoInscricao"("status", "reservaExpiraEm");

CREATE TABLE IF NOT EXISTS "EventoPagamentoTentativa" (
  "id" TEXT NOT NULL,
  "inscricaoId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metodo" TEXT,
  "valor" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoPagamentoTentativa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventoPagamentoTentativa_paymentId_key"
  ON "EventoPagamentoTentativa"("paymentId");
CREATE INDEX IF NOT EXISTS "EventoPagamentoTentativa_inscricaoId_status_idx"
  ON "EventoPagamentoTentativa"("inscricaoId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EventoPagamentoTentativa_inscricaoId_fkey'
      AND conrelid = '"EventoPagamentoTentativa"'::regclass
  ) THEN
    ALTER TABLE "EventoPagamentoTentativa"
      ADD CONSTRAINT "EventoPagamentoTentativa_inscricaoId_fkey"
      FOREIGN KEY ("inscricaoId") REFERENCES "EventoInscricao"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "EventoReembolsoPagamento" (
  "id" TEXT NOT NULL,
  "inscricaoId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "status" "ReembolsoStatus" NOT NULL DEFAULT 'PENDENTE',
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "ultimoErro" TEXT,
  "proximaTentativaEm" TIMESTAMP(3),
  "concluidoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoReembolsoPagamento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventoReembolsoPagamento_paymentId_key"
  ON "EventoReembolsoPagamento"("paymentId");
CREATE INDEX IF NOT EXISTS "EventoReembolsoPagamento_status_proximaTentativaEm_idx"
  ON "EventoReembolsoPagamento"("status", "proximaTentativaEm");
CREATE INDEX IF NOT EXISTS "EventoReembolsoPagamento_inscricaoId_idx"
  ON "EventoReembolsoPagamento"("inscricaoId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'EventoReembolsoPagamento_inscricaoId_fkey'
      AND conrelid = '"EventoReembolsoPagamento"'::regclass
  ) THEN
    ALTER TABLE "EventoReembolsoPagamento"
      ADD CONSTRAINT "EventoReembolsoPagamento_inscricaoId_fkey"
      FOREIGN KEY ("inscricaoId") REFERENCES "EventoInscricao"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
