-- Envio pelo Melhor Envio direto do site (sem passar pelo Olist).
-- Aditivo e nullable: pedidos antigos e retirada na loja seguem com NULL.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "melhorEnvioId" TEXT,
ADD COLUMN IF NOT EXISTS "melhorEnvioStatus" TEXT,
ADD COLUMN IF NOT EXISTS "melhorEnvioEtiqueta" TEXT;
