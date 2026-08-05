-- Troca a flag de consentimento por um timestamp: LGPD exige comprovar QUANDO
-- a pessoa consentiu, não só que consentiu. Também alinha tipo e nome com
-- EventoPirelliVisitante.consentimentoMarketingEm para permitir ligação
-- direta entre o cadastro do evento e o lead do CRM sem conversão.
ALTER TABLE "CrmLead" DROP COLUMN "consentimentoMarketing";
ALTER TABLE "CrmLead" ADD COLUMN "consentimentoMarketingEm" TIMESTAMP(3);
