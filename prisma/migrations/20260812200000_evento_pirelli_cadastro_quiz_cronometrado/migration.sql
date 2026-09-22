-- O cadastro passa a identificar a pessoa e sua moto; o nome da gravação só
-- existe quando ela compra ou conquista uma caneca. Colunas novas são
-- opcionais no banco para preservar participantes já cadastrados em produção.
ALTER TABLE "EventoPirelliVisitante"
ALTER COLUMN "nomeGravacao" DROP NOT NULL,
ALTER COLUMN "nomeGravacaoConfirmadoEm" DROP NOT NULL,
ADD COLUMN "enderecoCep" TEXT,
ADD COLUMN "enderecoRua" TEXT,
ADD COLUMN "enderecoNumero" TEXT,
ADD COLUMN "enderecoComplemento" TEXT,
ADD COLUMN "enderecoBairro" TEXT,
ADD COLUMN "enderecoCidade" TEXT,
ADD COLUMN "enderecoEstado" TEXT,
ADD COLUMN "motoMarca" TEXT,
ADD COLUMN "motoModelo" TEXT,
ADD COLUMN "motoAno" INTEGER;

ALTER TABLE "EventoPirelliVisitante"
ADD CONSTRAINT "EventoPirelliVisitante_enderecoCep_check"
CHECK ("enderecoCep" IS NULL OR "enderecoCep" ~ '^[0-9]{8}$'),
ADD CONSTRAINT "EventoPirelliVisitante_enderecoEstado_check"
CHECK ("enderecoEstado" IS NULL OR "enderecoEstado" ~ '^[A-Z]{2}$'),
ADD CONSTRAINT "EventoPirelliVisitante_motoAno_check"
CHECK ("motoAno" IS NULL OR "motoAno" BETWEEN 1900 AND 2100);

-- Tentativas anteriores já estavam concluídas. O backfill conserva o histórico
-- sem inventar uma duração competitiva para elas.
ALTER TABLE "EventoPirelliQuizTentativa"
ALTER COLUMN "pontuacao" SET DEFAULT 0,
ALTER COLUMN "pontuacaoMaxima" SET DEFAULT 0,
ALTER COLUMN "concluidaEm" DROP DEFAULT,
ALTER COLUMN "concluidaEm" DROP NOT NULL,
ADD COLUMN "iniciadaEm" TIMESTAMP(3),
ADD COLUMN "duracaoMs" INTEGER,
ADD COLUMN "ordemPerguntas" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "ordemOpcoes" JSONB NOT NULL DEFAULT '{}';

UPDATE "EventoPirelliQuizTentativa"
SET "iniciadaEm" = COALESCE("concluidaEm", CURRENT_TIMESTAMP)
WHERE "iniciadaEm" IS NULL;

ALTER TABLE "EventoPirelliQuizTentativa"
ALTER COLUMN "iniciadaEm" SET NOT NULL,
ALTER COLUMN "iniciadaEm" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "EventoPirelliQuizTentativa"
ADD CONSTRAINT "EventoPirelliQuizTentativa_duracaoMs_check"
CHECK ("duracaoMs" IS NULL OR "duracaoMs" >= 0);

CREATE INDEX "EventoPirelliQuizTentativa_acertouTodas_duracaoMs_concluidaEm_idx"
ON "EventoPirelliQuizTentativa"("acertouTodas", "duracaoMs", "concluidaEm");
