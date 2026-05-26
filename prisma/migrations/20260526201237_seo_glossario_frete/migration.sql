-- CreateEnum
CREATE TYPE "OrigemCliente" AS ENUM ('ECOMMERCE', 'MERCADOLIVRE', 'AGENDAMENTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "CanalVenda" AS ENUM ('ECOMMERCE', 'MERCADOLIVRE');

-- CreateEnum
CREATE TYPE "CRMCategoria" AS ENUM ('VENDA_ECOMMERCE', 'VENDA_ML', 'SERVICO', 'MISTO');

-- CreateEnum
CREATE TYPE "GlossaryOrigem" AS ENUM ('MANUAL', 'AI_GEMINI', 'AI_OPENAI', 'CSV_IMPORT');

-- CreateEnum
CREATE TYPE "GlossaryJobStatus" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO');

-- CreateEnum
CREATE TYPE "SeoIndexingAction" AS ENUM ('URL_UPDATED', 'URL_DELETED');

-- CreateEnum
CREATE TYPE "SeoIndexingProvider" AS ENUM ('GOOGLE', 'INDEXNOW');

-- CreateEnum
CREATE TYPE "SeoIndexingStatus" AS ENUM ('PENDENTE', 'SUCESSO', 'FALHA', 'IGNORADO');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "valorServico" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "CustomerCRM" ADD COLUMN     "categoria" "CRMCategoria" NOT NULL DEFAULT 'VENDA_ECOMMERCE',
ADD COLUMN     "totalServicos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultimoServico" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "canal" "CanalVenda" NOT NULL DEFAULT 'ECOMMERCE',
ADD COLUMN     "fretePrazo" INTEGER,
ADD COLUMN     "freteServico" TEXT,
ADD COLUMN     "freteTransportadora" TEXT,
ADD COLUMN     "trackingCode" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "altura" DECIMAL(8,2),
ADD COLUMN     "comprimento" DECIMAL(8,2),
ADD COLUMN     "imagensVerificadas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "largura" DECIMAL(8,2),
ADD COLUMN     "peso" DECIMAL(8,3),
ADD COLUMN     "temImagem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tinyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "origem" "OrigemCliente" NOT NULL DEFAULT 'ECOMMERCE',
ADD COLUMN     "tinyClienteId" TEXT;

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" TEXT NOT NULL,
    "termo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "letra" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "resumo" TEXT,
    "imagem" TEXT,
    "autor" TEXT NOT NULL DEFAULT 'Equipe Forza',
    "categoria" TEXT,
    "relacionados" JSONB NOT NULL DEFAULT '[]',
    "origem" "GlossaryOrigem" NOT NULL DEFAULT 'MANUAL',
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlossaryJob" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "letra" TEXT NOT NULL,
    "nicho" TEXT NOT NULL,
    "provider" "GlossaryOrigem" NOT NULL DEFAULT 'AI_GEMINI',
    "modelo" TEXT NOT NULL,
    "idioma" TEXT NOT NULL DEFAULT 'pt-BR',
    "estilo" TEXT NOT NULL DEFAULT 'informativo e técnico',
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "promptExtra" TEXT,
    "status" "GlossaryJobStatus" NOT NULL DEFAULT 'PENDENTE',
    "agendadoPara" TIMESTAMP(3),
    "termoId" TEXT,
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlossaryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoRedirect" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoNotFoundLog" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "userAgent" TEXT,
    "referer" TEXT,
    "ip" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 1,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "ultimoAcesso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoNotFoundLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeoIndexingLog" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "action" "SeoIndexingAction" NOT NULL DEFAULT 'URL_UPDATED',
    "provider" "SeoIndexingProvider" NOT NULL,
    "status" "SeoIndexingStatus" NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "resposta" TEXT,
    "origem" TEXT,
    "enviadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoIndexingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_slug_key" ON "GlossaryTerm"("slug");

-- CreateIndex
CREATE INDEX "GlossaryTerm_letra_publicado_idx" ON "GlossaryTerm"("letra", "publicado");

-- CreateIndex
CREATE INDEX "GlossaryTerm_categoria_publicado_idx" ON "GlossaryTerm"("categoria", "publicado");

-- CreateIndex
CREATE INDEX "GlossaryTerm_createdAt_idx" ON "GlossaryTerm"("createdAt");

-- CreateIndex
CREATE INDEX "GlossaryJob_status_agendadoPara_idx" ON "GlossaryJob"("status", "agendadoPara");

-- CreateIndex
CREATE UNIQUE INDEX "SeoRedirect_from_key" ON "SeoRedirect"("from");

-- CreateIndex
CREATE INDEX "SeoRedirect_from_ativo_idx" ON "SeoRedirect"("from", "ativo");

-- CreateIndex
CREATE INDEX "SeoNotFoundLog_resolvido_hits_idx" ON "SeoNotFoundLog"("resolvido", "hits");

-- CreateIndex
CREATE UNIQUE INDEX "SeoNotFoundLog_path_key" ON "SeoNotFoundLog"("path");

-- CreateIndex
CREATE INDEX "SeoIndexingLog_url_provider_idx" ON "SeoIndexingLog"("url", "provider");

-- CreateIndex
CREATE INDEX "SeoIndexingLog_status_createdAt_idx" ON "SeoIndexingLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SeoIndexingLog_createdAt_idx" ON "SeoIndexingLog"("createdAt");

