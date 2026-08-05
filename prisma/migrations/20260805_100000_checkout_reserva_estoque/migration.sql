-- Separa saldo FÍSICO (Product.estoque, o que o sync do Tiny sobrescreve) da
-- RESERVA local (Product.estoqueReservado, o que pedidos pendentes seguram).
-- Disponível para venda = estoque - estoqueReservado.
ALTER TABLE "Product" ADD COLUMN "estoqueReservado" INTEGER NOT NULL DEFAULT 0;

-- Backfill: materializa na coluna nova a reserva dos pedidos ainda pendentes.
--
-- NÃO somamos a quantidade de volta em "estoque". A tentação é achar que o
-- modelo antigo tinha descontado a reserva de "estoque" e que é preciso
-- recompor o físico — mas esse decremento NUNCA foi durável: o worker
-- (worker.js, job de estoque) e `verificarEstoqueTiny` com `atualizarBanco`
-- sobrescreviam "estoque" com o saldo cru do Tiny a cada passada. Esse é
-- exatamente o bloqueador de oversell que esta linha de trabalho corrige.
--
-- Ou seja: para qualquer pedido pendente que tenha sobrevivido a uma
-- ressincronização — na prática todos, porque o job roda de hora em hora —
-- "estoque" já É o saldo físico. Somar a quantidade em cima criaria unidade
-- fantasma, e justamente na direção insegura: mais disponível do que existe,
-- em cima dos produtos que esta migration deveria proteger.
--
-- Escrever só a reserva erra no máximo para o lado conservador (disponível
-- menor por um ciclo) e se corrige sozinho: a reconciliação expira reservas
-- vencidas e devolve as unidades.
WITH reservas AS (
  SELECT oi."productId" AS product_id, SUM(oi.quantidade)::int AS qtd
  FROM "OrderItem" oi
  JOIN "Order" o ON o.id = oi."orderId"
  WHERE o.status = 'AGUARDANDO_PAGAMENTO'
    AND oi."estoqueReservado" = true
  GROUP BY oi."productId"
)
UPDATE "Product" p
SET "estoqueReservado" = r.qtd
FROM reservas r
WHERE p.id = r.product_id;

CREATE INDEX "Product_estoqueReservado_idx" ON "Product"("estoqueReservado");
