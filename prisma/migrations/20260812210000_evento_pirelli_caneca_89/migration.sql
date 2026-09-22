-- Atualiza o preço público da caneca personalizada sem alterar pedidos
-- existentes, que preservam o valor unitário gravado no momento da compra.
ALTER TABLE "EventoPirelli"
ALTER COLUMN "valorCanecaAvulsa" SET DEFAULT 89.00;

UPDATE "EventoPirelli"
SET "valorCanecaAvulsa" = 89.00,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'pirelli-forza';
