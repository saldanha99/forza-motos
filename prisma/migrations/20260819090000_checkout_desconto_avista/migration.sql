CREATE TYPE "MeioPagamentoCheckout" AS ENUM ('PIX', 'BOLETO', 'CARTAO');

-- Coluna nullable: pedidos anteriores continuam válidos e o ALTER não precisa
-- reescrever a tabela. Pedidos novos sempre recebem a modalidade no servidor.
ALTER TABLE "Order"
ADD COLUMN "meioPagamentoCheckout" "MeioPagamentoCheckout";
