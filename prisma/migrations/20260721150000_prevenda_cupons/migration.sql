-- Pré-venda no produto
ALTER TABLE "Product" ADD COLUMN "preVenda" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "prazoEntregaDias" INTEGER;

-- Cupom aplicado no pedido
ALTER TABLE "Order" ADD COLUMN "cupomCodigo" TEXT;

-- Tipo de cupom
CREATE TYPE "CupomTipo" AS ENUM ('PERCENTUAL', 'VALOR');

-- Tabela de cupons
CREATE TABLE "Cupom" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "CupomTipo" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "minSubtotal" DECIMAL(10,2),
    "validadeAte" TIMESTAMP(3),
    "usoMaximo" INTEGER,
    "usados" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");
