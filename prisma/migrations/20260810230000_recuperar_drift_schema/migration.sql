-- Registra no histórico alterações antigas que existiam em produção por
-- introspecção/db push, mas não estavam reproduzíveis pelas migrations.
-- Todas as mudanças aditivas toleram bancos que já possuam esses objetos.

CREATE TABLE IF NOT EXISTS "Setting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "Moto"
  ADD COLUMN IF NOT EXISTS "medidaDianteira" TEXT,
  ADD COLUMN IF NOT EXISTS "medidaTraseira" TEXT,
  ADD COLUMN IF NOT EXISTS "medidasConferidas" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "fonteMedidas" TEXT;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "medidaLargura" INTEGER,
  ADD COLUMN IF NOT EXISTS "medidaPerfil" INTEGER,
  ADD COLUMN IF NOT EXISTS "medidaAro" INTEGER,
  ADD COLUMN IF NOT EXISTS "medidaConstrucao" TEXT;

CREATE INDEX IF NOT EXISTS "Product_medidaLargura_medidaPerfil_medidaAro_idx"
  ON "Product"("medidaLargura", "medidaPerfil", "medidaAro");

-- O filtro por fornecedor deixou de existir; evita manter um índice sem uso.
DROP INDEX IF EXISTS "Product_fornecedor_idx";

-- Respostas textuais não têm opção. Se uma opção antiga for removida, o
-- snapshot histórico permanece e apenas a referência opcional vira NULL.
ALTER TABLE "EventoPirelliQuizResposta"
  DROP CONSTRAINT IF EXISTS "EventoPirelliQuizResposta_opcaoId_fkey";
ALTER TABLE "EventoPirelliQuizResposta"
  ADD CONSTRAINT "EventoPirelliQuizResposta_opcaoId_fkey"
  FOREIGN KEY ("opcaoId") REFERENCES "EventoPirelliQuizOpcao"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
