-- Invariante: produto sem disponível não fica na vitrine.
--
-- `Product.ativo` tem ~15 escritores (sync do Olist, worker, rotas de
-- curadoria, checkout). Corrigir a fórmula em cada um resolve hoje e volta a
-- quebrar no próximo escritor — e o modo de falha é silencioso: o produto
-- reaparece na vitrine segundos depois de uma reserva e o comprador seguinte
-- só descobre no último passo do checkout.
--
-- Esta trava fecha a classe inteira do problema. Ela só sabe DESATIVAR: nunca
-- liga `ativo`, então continua sendo dos escritores a decisão de exibir. Erra,
-- portanto, sempre para o lado seguro.
--
-- Pré-venda é a exceção legítima: vende com saldo zero por definição.
CREATE OR REPLACE FUNCTION product_ativo_exige_disponivel() RETURNS trigger AS $$
BEGIN
  IF NEW."ativo"
     AND NOT COALESCE(NEW."preVenda", false)
     AND (NEW."estoque" - NEW."estoqueReservado") <= 0
  THEN
    NEW."ativo" := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_ativo_exige_disponivel ON "Product";

CREATE TRIGGER product_ativo_exige_disponivel
BEFORE INSERT OR UPDATE ON "Product"
FOR EACH ROW
EXECUTE FUNCTION product_ativo_exige_disponivel();

-- Repara quem já está violando a invariante (inclusive as reservas que a
-- migration anterior materializou).
UPDATE "Product"
SET "ativo" = false
WHERE "ativo" = true
  AND COALESCE("preVenda", false) = false
  AND ("estoque" - "estoqueReservado") <= 0;
