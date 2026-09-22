-- Fecha o quiz separadamente do restante do evento e congela exatamente uma
-- tentativa vencedora. O id e unico, indexa a FK e torna a apuracao idempotente.
ALTER TABLE "EventoPirelli"
  ADD COLUMN "quizEncerradoEm" TIMESTAMP(3),
  ADD COLUMN "quizEncerradoPor" TEXT,
  ADD COLUMN "quizVencedorTentativaId" TEXT;

ALTER TABLE "EventoPirelli"
  ADD CONSTRAINT "EventoPirelli_quiz_encerramento_check"
  CHECK (
    ("quizEncerradoEm" IS NULL AND "quizEncerradoPor" IS NULL AND "quizVencedorTentativaId" IS NULL)
    OR ("quizEncerradoEm" IS NOT NULL AND "quizEncerradoPor" IS NOT NULL)
  );

CREATE UNIQUE INDEX "EventoPirelli_quizVencedorTentativaId_key"
  ON "EventoPirelli"("quizVencedorTentativaId");

ALTER TABLE "EventoPirelli"
  ADD CONSTRAINT "EventoPirelli_quizVencedorTentativaId_fkey"
  FOREIGN KEY ("quizVencedorTentativaId")
  REFERENCES "EventoPirelliQuizTentativa"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

DROP INDEX "EventoPirelliQuizTentativa_acertouTodas_duracaoMs_concluidaEm_idx";
CREATE INDEX "EventoPirelliQuizTentativa_acertouTodas_duracaoMs_concluidaEm_id_idx"
  ON "EventoPirelliQuizTentativa"("acertouTodas", "duracaoMs", "concluidaEm", "id");

-- Corrige a alternativa da primeira pergunta para refletir o gabarito tecnico
-- descrito na explicacao: B = construcao diagonal cintada (Bias-Belted).
UPDATE "EventoPirelliQuizOpcao"
SET "texto" = 'Construção diagonal cintada (Bias-Belted)', "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'pirelli-rodeo-q01-o02'
  AND "texto" = 'Construção reforçada';
