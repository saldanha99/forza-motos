-- O envio comercial só pode ser preparado depois que a chave fiscal foi
-- emitida e registrada por um administrador.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "nfeChave" TEXT,
  ADD COLUMN IF NOT EXISTS "nfeRegistradaEm" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Order_nfeChave_key"
  ON "Order"("nfeChave");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Order_nfeChave_formato_check'
      AND conrelid = '"Order"'::regclass
  ) THEN
    ALTER TABLE "Order"
      ADD CONSTRAINT "Order_nfeChave_formato_check"
      CHECK ("nfeChave" IS NULL OR "nfeChave" ~ '^[0-9]{44}$');
  END IF;
END $$;
