-- Curadoria de produtos: origem do fornecedor + flag de manter na loja
ALTER TABLE "Product" ADD COLUMN "fornecedor" TEXT;
ALTER TABLE "Product" ADD COLUMN "mantidoManual" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_fornecedor_idx" ON "Product"("fornecedor");
