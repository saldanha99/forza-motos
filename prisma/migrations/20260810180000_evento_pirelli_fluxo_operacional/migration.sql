-- Completa o fluxo operacional dos quatro QR Codes da ação Pirelli + Forza.
-- Alterações aditivas: preservam visitantes e participações já existentes.

ALTER TABLE "EventoPirelliBalanceamento"
  ADD COLUMN "confirmadoEm" TIMESTAMP(3),
  ADD COLUMN "participouEm" TIMESTAMP(3),
  ADD COLUMN "atualizadoPor" TEXT;

ALTER TABLE "EventoPirelliParticipacaoFoto"
  ADD COLUMN "declarouHashtag" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "declarouPerfilPublico" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EventoPirelliVisitante"
  ADD COLUMN "kitParticipacaoEntregueEm" TIMESTAMP(3),
  ADD COLUMN "kitParticipacaoEntreguePor" TEXT;

-- 9º Lucky Friends Rodeo Motorcycle: 5 e 6 de setembro de 2026.
-- Prisma persiste DateTime em UTC; 11h de Brasília = 14h UTC.
UPDATE "EventoPirelli"
SET
  "dataInicio" = TIMESTAMP '2026-09-05 14:00:00',
  "dataFim" = TIMESTAMP '2026-09-07 02:59:59.999',
  "local" = COALESCE(NULLIF("local", ''), 'Lucky Friends Arena — Sorocaba/SP'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'pirelli-forza';
