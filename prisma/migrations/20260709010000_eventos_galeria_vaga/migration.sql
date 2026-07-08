-- Carrossel de fotos + opções de vaga (sozinho/garupa/grupo) nos eventos
ALTER TABLE "Evento" ADD COLUMN "galeria" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Evento" ADD COLUMN "opcoesVaga" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "EventoInscricao" ADD COLUMN "opcaoVagaLabel" TEXT;
ALTER TABLE "EventoInscricao" ADD COLUMN "opcaoVagaPreco" DECIMAL(10,2);
