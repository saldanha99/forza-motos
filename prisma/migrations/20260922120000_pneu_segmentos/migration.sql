-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "pneuLinha" TEXT,
ADD COLUMN     "pneuSegmentoId" TEXT;

-- CreateTable
CREATE TABLE "PneuSegmento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT,
    "imagemUrl" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PneuSegmento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PneuSegmento_nome_key" ON "PneuSegmento"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "PneuSegmento_slug_key" ON "PneuSegmento"("slug");

-- CreateIndex
CREATE INDEX "PneuSegmento_ativo_ordem_idx" ON "PneuSegmento"("ativo", "ordem");

-- CreateIndex
CREATE INDEX "Product_pneuSegmentoId_ativo_idx" ON "Product"("pneuSegmentoId", "ativo");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_pneuSegmentoId_fkey" FOREIGN KEY ("pneuSegmentoId") REFERENCES "PneuSegmento"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Segmentos iniciais pedidos pela loja. O admin renomeia, reordena e cria
-- outros em /admin/pneus-segmentos — por isso a tabela, e não um enum.
INSERT INTO "PneuSegmento" ("id", "nome", "slug", "descricao", "ordem", "ativo", "createdAt", "updatedAt")
VALUES
  ('pneuseg_custom',    'Custom',            'custom',            'Pneus para custom e big custom',            1, true, NOW(), NOW()),
  ('pneuseg_bigtrail',  'Big Trail',         'big-trail',         'Pneus para big trail e adventure',          2, true, NOW(), NOW()),
  ('pneuseg_esportivo', 'Esportivo/Street',  'esportivo-street',  'Pneus esportivos e de uso urbano',          3, true, NOW(), NOW()),
  ('pneuseg_scooter',   'Scooter',           'scooter',           'Pneus para scooters e motos automáticas',   4, true, NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
