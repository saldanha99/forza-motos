-- A confirmação manual do operador é a evidência do pagamento presencial.
-- A referência da maquininha continua disponível para registros antigos, mas deixa de ser obrigatória.
ALTER TABLE "EventoPirelliLancamentoCaixa"
DROP CONSTRAINT IF EXISTS "EventoPirelliLancamentoCaixa_referenciaPagamento_check";

ALTER TABLE "EventoPirelliVendaPresencial"
DROP CONSTRAINT IF EXISTS "EventoPirelliVendaPresencial_referencia_pagamento_check";
