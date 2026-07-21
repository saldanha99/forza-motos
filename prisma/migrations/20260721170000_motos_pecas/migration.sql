-- Motos (com faixa de ano)
CREATE TABLE "Moto" (
    "id" TEXT NOT NULL,
    "marca" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "anoDe" INTEGER NOT NULL,
    "anoAte" INTEGER,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Moto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Moto_slug_key" ON "Moto"("slug");
CREATE UNIQUE INDEX "Moto_marca_modelo_anoDe_anoAte_key" ON "Moto"("marca", "modelo", "anoDe", "anoAte");
CREATE INDEX "Moto_marca_modelo_idx" ON "Moto"("marca", "modelo");

-- Vínculo produto <-> moto (N:N)
CREATE TABLE "ProdutoMoto" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "motoId" TEXT NOT NULL,
    CONSTRAINT "ProdutoMoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProdutoMoto_productId_motoId_key" ON "ProdutoMoto"("productId", "motoId");
CREATE INDEX "ProdutoMoto_motoId_idx" ON "ProdutoMoto"("motoId");
CREATE INDEX "ProdutoMoto_productId_idx" ON "ProdutoMoto"("productId");

ALTER TABLE "ProdutoMoto" ADD CONSTRAINT "ProdutoMoto_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProdutoMoto" ADD CONSTRAINT "ProdutoMoto_motoId_fkey" FOREIGN KEY ("motoId") REFERENCES "Moto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
