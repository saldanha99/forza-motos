-- A publicação da landing continua independente das vitrines públicas.
-- Os defaults false preservam o comportamento atual até o admin optar pela exibição.
ALTER TABLE "EventoPirelli"
ADD COLUMN "exibirNaHome" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exibirEmEventos" BOOLEAN NOT NULL DEFAULT false;
