ALTER TABLE "EventoPirelliVisitante"
  ADD COLUMN "nomeGravacaoConfirmadoPor" TEXT;

-- Registros anteriores possuem horário, mas não guardavam a origem da
-- confirmação. Mantemos a auditoria honesta em vez de atribuir um operador.
UPDATE "EventoPirelliVisitante"
SET "nomeGravacaoConfirmadoPor" = 'Registro anterior à auditoria'
WHERE "nomeGravacaoConfirmadoEm" IS NOT NULL;
