-- Variações de tamanho: liga filho ao produto-pai (_PAI do Tiny)
ALTER TABLE "Product" ADD COLUMN "variacaoDe" TEXT;
ALTER TABLE "Product" ADD COLUMN "ehPai" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_variacaoDe_idx" ON "Product"("variacaoDe");
