-- CreateTable
CREATE TABLE "MarketingBanner" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "imagemUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingBanner_chave_key" ON "MarketingBanner"("chave");
