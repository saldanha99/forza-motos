-- Quiz oficial da ação Pirelli + Forza Motos no Rodeo Lucky Friends.
-- Mantém tentativas antigas íntegras (snapshots) e ativa um novo conjunto de perguntas.

CREATE TYPE "EventoPirelliQuizTipo" AS ENUM ('MULTIPLA_ESCOLHA', 'TEXTO');

ALTER TABLE "EventoPirelli"
  ADD COLUMN "valorCanecaAvulsa" DECIMAL(10,2) NOT NULL DEFAULT 135;

ALTER TABLE "EventoPirelliQuizPergunta"
  ADD COLUMN "tipo" "EventoPirelliQuizTipo" NOT NULL DEFAULT 'MULTIPLA_ESCOLHA',
  ADD COLUMN "respostaCorretaTexto" TEXT;

ALTER TABLE "EventoPirelliQuizResposta"
  ALTER COLUMN "opcaoId" DROP NOT NULL,
  ADD COLUMN "respostaTexto" TEXT;

CREATE INDEX "EventoPirelliCompraCaneca_visitanteId_idx"
  ON "EventoPirelliCompraCaneca"("visitanteId");
CREATE INDEX "EventoPirelliElegibilidadeCaneca_canecaId_idx"
  ON "EventoPirelliElegibilidadeCaneca"("canecaId");
CREATE INDEX "EventoPirelliQuizResposta_perguntaId_idx"
  ON "EventoPirelliQuizResposta"("perguntaId");
CREATE INDEX "EventoPirelliQuizResposta_opcaoId_idx"
  ON "EventoPirelliQuizResposta"("opcaoId");

-- Perguntas antigas ficam disponíveis no histórico/admin, mas saem da tentativa oficial.
UPDATE "EventoPirelliQuizPergunta"
SET "ativa" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "eventoId" = (SELECT "id" FROM "EventoPirelli" WHERE "slug" = 'pirelli-forza');

INSERT INTO "EventoPirelliQuizPergunta"
  ("id", "eventoId", "enunciado", "explicacao", "tipo", "respostaCorretaTexto", "ordem", "pontos", "ativa", "createdAt", "updatedAt")
SELECT pergunta."id", evento."id", pergunta."enunciado", pergunta."explicacao",
       pergunta."tipo"::"EventoPirelliQuizTipo", pergunta."respostaCorretaTexto",
       pergunta."ordem", 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "EventoPirelli" evento
CROSS JOIN (VALUES
  ('pirelli-rodeo-q01', 'O que significa a letra "B" na medida 150/80B16?', 'A letra B identifica uma construção diagonal cintada (Bias-Belted).', 'MULTIPLA_ESCOLHA', NULL, 0),
  ('pirelli-rodeo-q02', 'O que representa a sigla TL?', 'TL significa Tubeless: pneu projetado para uso sem câmara.', 'MULTIPLA_ESCOLHA', NULL, 1),
  ('pirelli-rodeo-q03', 'O índice de velocidade W corresponde a qual velocidade?', 'O símbolo W corresponde à velocidade máxima de 270 km/h nas condições especificadas pelo fabricante.', 'MULTIPLA_ESCOLHA', NULL, 2),
  ('pirelli-rodeo-q04', 'Os pneus Pirelli e Metzeler têm altos níveis de sílica em sua composição para:', 'A sílica contribui para a aderência, especialmente em condições de pista molhada, e favorece o aquecimento do composto.', 'MULTIPLA_ESCOLHA', NULL, 3),
  ('pirelli-rodeo-q05', 'Qual é o mais novo pneu da Pirelli desenvolvido para motocicletas custom e cruiser modernas?', 'O DIABLO POWERCRUISER combina o DNA esportivo da Pirelli com motos custom e cruiser de alto desempenho.', 'MULTIPLA_ESCOLHA', NULL, 4),
  ('pirelli-rodeo-q06', 'O que significa a sigla TWI geralmente gravada na lateral do pneu?', 'TWI significa Tire Wear Indicator e identifica a posição dos indicadores de desgaste da banda de rodagem.', 'MULTIPLA_ESCOLHA', NULL, 5),
  ('pirelli-rodeo-q07', 'Qual é o primeiro pneu bi-composto do segmento custom?', 'O Metzeler Cruisetec utiliza tecnologia bi-composto na medida traseira para combinar estabilidade, aquecimento e aderência.', 'MULTIPLA_ESCOLHA', NULL, 6),
  ('pirelli-rodeo-q08', E'🏁 Pergunta Final – Valendo o Brinde!\n\nAgora queremos saber se você prestou atenção!\n\nQual é o nome da loja especialista em pneus para motocicletas, revendedora autorizada Pirelli e Metzeler, que está realizando esta ação no Rodeo Lucky Friends?\n\n✍️ Digite sua resposta:', 'A ação é realizada pela Forza Motos.', 'TEXTO', 'FORZA MOTOS', 7)
) AS pergunta("id", "enunciado", "explicacao", "tipo", "respostaCorretaTexto", "ordem")
WHERE evento."slug" = 'pirelli-forza';

INSERT INTO "EventoPirelliQuizOpcao"
  ("id", "perguntaId", "texto", "correta", "ordem", "ativa", "createdAt", "updatedAt")
SELECT opcao."id", opcao."perguntaId", opcao."texto", opcao."correta", opcao."ordem",
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "EventoPirelli" evento
CROSS JOIN (VALUES
  ('pirelli-rodeo-q01-o01', 'pirelli-rodeo-q01', 'Banda larga', false, 0),
  ('pirelli-rodeo-q01-o02', 'pirelli-rodeo-q01', 'Construção reforçada', true, 1),
  ('pirelli-rodeo-q01-o03', 'pirelli-rodeo-q01', 'Pneu balanceado', false, 2),
  ('pirelli-rodeo-q01-o04', 'pirelli-rodeo-q01', 'Banda de rodagem 16', false, 3),

  ('pirelli-rodeo-q02-o01', 'pirelli-rodeo-q02', 'Tube Locked', false, 0),
  ('pirelli-rodeo-q02-o02', 'pirelli-rodeo-q02', 'Tire Light', false, 1),
  ('pirelli-rodeo-q02-o03', 'pirelli-rodeo-q02', 'Tubeless', true, 2),
  ('pirelli-rodeo-q02-o04', 'pirelli-rodeo-q02', 'Trail Line', false, 3),

  ('pirelli-rodeo-q03-o01', 'pirelli-rodeo-q03', '270 km/h', true, 0),
  ('pirelli-rodeo-q03-o02', 'pirelli-rodeo-q03', '300 km/h', false, 1),
  ('pirelli-rodeo-q03-o03', 'pirelli-rodeo-q03', '240 km/h', false, 2),
  ('pirelli-rodeo-q03-o04', 'pirelli-rodeo-q03', '210 km/h', false, 3),

  ('pirelli-rodeo-q04-o01', 'pirelli-rodeo-q04', 'Deixar o pneu mais leve', false, 0),
  ('pirelli-rodeo-q04-o02', 'pirelli-rodeo-q04', 'Facilitar a montagem', false, 1),
  ('pirelli-rodeo-q04-o03', 'pirelli-rodeo-q04', 'Aumentar apenas a rigidez', false, 2),
  ('pirelli-rodeo-q04-o04', 'pirelli-rodeo-q04', 'Aumentar a aderência', true, 3),

  ('pirelli-rodeo-q05-o01', 'pirelli-rodeo-q05', 'Diablo Rosso IV', false, 0),
  ('pirelli-rodeo-q05-o02', 'pirelli-rodeo-q05', 'Angel GT II', false, 1),
  ('pirelli-rodeo-q05-o03', 'pirelli-rodeo-q05', 'Scorpion Trail III', false, 2),
  ('pirelli-rodeo-q05-o04', 'pirelli-rodeo-q05', 'Diablo Powercruiser', true, 3),

  ('pirelli-rodeo-q06-o01', 'pirelli-rodeo-q06', 'Tire Wear Indicator', true, 0),
  ('pirelli-rodeo-q06-o02', 'pirelli-rodeo-q06', 'Traction Wheel Index', false, 1),
  ('pirelli-rodeo-q06-o03', 'pirelli-rodeo-q06', 'Tube Wheel Inspection', false, 2),
  ('pirelli-rodeo-q06-o04', 'pirelli-rodeo-q06', 'Temperature Warning Indicator', false, 3),

  ('pirelli-rodeo-q07-o01', 'pirelli-rodeo-q07', 'Metzeler Cruisetec', true, 0),
  ('pirelli-rodeo-q07-o02', 'pirelli-rodeo-q07', 'Pirelli Night Dragon', false, 1),
  ('pirelli-rodeo-q07-o03', 'pirelli-rodeo-q07', 'Metzeler Marathon ME888', false, 2),
  ('pirelli-rodeo-q07-o04', 'pirelli-rodeo-q07', 'Pirelli Route MT66', false, 3)
) AS opcao("id", "perguntaId", "texto", "correta", "ordem")
WHERE evento."slug" = 'pirelli-forza';
