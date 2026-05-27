-- CreateEnum
CREATE TYPE "LeadOrigem" AS ENUM ('POPUP', 'WHATSAPP_BTN', 'AGENDAMENTO', 'CHECKOUT', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadEtapa" AS ENUM ('NOVO', 'CONTATADO', 'RESPONDEU', 'CONVERTIDO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "MensagemTipo" AS ENUM ('BOAS_VINDAS', 'AGENDAMENTO', 'PEDIDO_CONFIRMADO', 'PEDIDO_ENVIADO', 'CARRINHO_ABANDONADO', 'POS_VENDA', 'REATIVACAO', 'MANUAL');

-- CreateEnum
CREATE TYPE "MensagemStatus" AS ENUM ('PENDENTE', 'ENVIANDO', 'ENVIADA', 'ENTREGUE', 'LIDA', 'FALHA', 'CANCELADA');

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "origem" "LeadOrigem" NOT NULL DEFAULT 'POPUP',
    "produtoSlug" TEXT,
    "etapa" "LeadEtapa" NOT NULL DEFAULT 'NOVO',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmMensagem" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT,
    "whatsapp" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "MensagemTipo" NOT NULL,
    "conteudo" TEXT NOT NULL,
    "status" "MensagemStatus" NOT NULL DEFAULT 'PENDENTE',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "evolutionId" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "erro" TEXT,
    "agendadoPara" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmMensagem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrmLead_whatsapp_idx" ON "CrmLead"("whatsapp");

-- CreateIndex
CREATE INDEX "CrmLead_etapa_createdAt_idx" ON "CrmLead"("etapa", "createdAt");

-- CreateIndex
CREATE INDEX "CrmMensagem_status_agendadoPara_idx" ON "CrmMensagem"("status", "agendadoPara");

-- CreateIndex
CREATE INDEX "CrmMensagem_whatsapp_idx" ON "CrmMensagem"("whatsapp");

-- CreateIndex
CREATE INDEX "CrmMensagem_createdAt_idx" ON "CrmMensagem"("createdAt");

-- AddForeignKey
ALTER TABLE "CrmMensagem" ADD CONSTRAINT "CrmMensagem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
