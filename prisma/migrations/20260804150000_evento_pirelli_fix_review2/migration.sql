-- Remediação da revisão 2 do módulo Evento Pirelli.
-- Nenhuma das duas tabelas tem uso em produção ainda, então backfill não é necessário.

-- Idempotência de venda de caneca (duplo clique/retry não deve criar duas vendas).
ALTER TABLE "EventoPirelliCompraCaneca" ADD COLUMN "chaveIdempotencia" TEXT NOT NULL DEFAULT '';
ALTER TABLE "EventoPirelliCompraCaneca" ALTER COLUMN "chaveIdempotencia" DROP DEFAULT;
CREATE UNIQUE INDEX "EventoPirelliCompraCaneca_chaveIdempotencia_key" ON "EventoPirelliCompraCaneca"("chaveIdempotencia");

-- Trilha de revogação de elegibilidade de brinde (ex.: corrigir vencedor de foto).
ALTER TABLE "EventoPirelliElegibilidadeCaneca" ADD COLUMN "revogadoEm" TIMESTAMP(3);
ALTER TABLE "EventoPirelliElegibilidadeCaneca" ADD COLUMN "revogadoPor" TEXT;
ALTER TABLE "EventoPirelliElegibilidadeCaneca" ADD COLUMN "revogadoMotivo" TEXT;
