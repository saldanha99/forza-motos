-- O cliente pode interromper automações respondendo PARE/SAIR. A coluna é
-- separada do consentimento de marketing porque avisos transacionais e ofertas
-- têm bases e expectativas diferentes.
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "whatsappOptOutEm" TIMESTAMP(3);
