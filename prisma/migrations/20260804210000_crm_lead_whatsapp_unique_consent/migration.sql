-- Deduplica CrmLead por whatsapp antes de tornar o número único. Duas
-- capturas concorrentes (findFirst + create sem lock) podiam criar dois
-- leads para o mesmo WhatsApp; aqui mantemos o mais antigo de cada número,
-- relinkamos as CrmMensagem das duplicatas para ele (preserva o histórico de
-- conversa em vez de quebrar a FK) e fundimos as notas antes de apagar.
WITH duplicados AS (
  SELECT id, "whatsapp", "createdAt",
         first_value(id) OVER (PARTITION BY "whatsapp" ORDER BY "createdAt", id) AS manter_id,
         row_number()   OVER (PARTITION BY "whatsapp" ORDER BY "createdAt", id) AS posicao
  FROM "CrmLead"
)
UPDATE "CrmMensagem" mensagem
SET "leadId" = duplicados.manter_id
FROM duplicados
WHERE mensagem."leadId" = duplicados.id AND duplicados.posicao > 1;

WITH duplicados AS (
  SELECT id, "whatsapp", "notas", "createdAt",
         first_value(id) OVER (PARTITION BY "whatsapp" ORDER BY "createdAt", id) AS manter_id,
         row_number()   OVER (PARTITION BY "whatsapp" ORDER BY "createdAt", id) AS posicao
  FROM "CrmLead"
),
notas_extras AS (
  SELECT manter_id, string_agg(notas, E'\n' ORDER BY "createdAt") AS notas_agregadas
  FROM duplicados
  WHERE posicao > 1 AND notas IS NOT NULL
  GROUP BY manter_id
)
-- RIGHT (não LEFT) para casar com o .slice(-4000) de lib/crm/leads.ts —
-- mantém as notas mais recentes quando o texto combinado excede o limite.
UPDATE "CrmLead" lead
SET notas = RIGHT(COALESCE(lead.notas, '') || CASE WHEN notas_extras.notas_agregadas IS NOT NULL THEN E'\n' || notas_extras.notas_agregadas ELSE '' END, 4000)
FROM notas_extras
WHERE lead.id = notas_extras.manter_id;

WITH duplicados AS (
  SELECT id, "whatsapp",
         row_number() OVER (PARTITION BY "whatsapp" ORDER BY "createdAt", id) AS posicao
  FROM "CrmLead"
)
DELETE FROM "CrmLead" lead
USING duplicados
WHERE lead.id = duplicados.id AND duplicados.posicao > 1;

-- Consentimento explícito de marketing (ex.: opt-in no Evento Pirelli).
-- Boolean por decisão deste round de revisão — a auditoria de "quando" já
-- existe por evento em EventoPirelliVisitante.consentimentoMarketingEm; este
-- campo é a flag geral do lead no CRM, usada para listagem/exportação.
ALTER TABLE "CrmLead" ADD COLUMN "consentimentoMarketing" BOOLEAN NOT NULL DEFAULT false;

-- A partir daqui a constraint única é a fonte de verdade contra corrida:
-- lib/crm/leads.ts passa a tratar P2002 nesse índice como "outra captura
-- venceu a corrida" em vez de confiar só no findFirst prévio.
CREATE UNIQUE INDEX "CrmLead_whatsapp_key" ON "CrmLead"("whatsapp");
