-- Novos eventos transacionais da jornada do pedido. A obrigação permanece
-- idempotente pela chave única da EmailOutbox e é enviada pelo worker atual.

ALTER TYPE "EmailOutboxTipo" ADD VALUE IF NOT EXISTS 'NFE_AUTORIZADA';
ALTER TYPE "EmailOutboxTipo" ADD VALUE IF NOT EXISTS 'PEDIDO_ENVIADO';
ALTER TYPE "EmailOutboxTipo" ADD VALUE IF NOT EXISTS 'PEDIDO_ENTREGUE';

ALTER TYPE "MensagemTipo" ADD VALUE IF NOT EXISTS 'PEDIDO_ENTREGUE';
