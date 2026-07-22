-- Status da reserva
CREATE TYPE "ReservaStatus" AS ENUM ('ATIVA', 'CONSUMIDA', 'CANCELADA');

-- Reserva de estoque vinculada a um agendamento
CREATE TABLE "ReservaEstoque" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "status" "ReservaStatus" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReservaEstoque_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReservaEstoque_productId_status_idx" ON "ReservaEstoque"("productId", "status");
CREATE INDEX "ReservaEstoque_appointmentId_idx" ON "ReservaEstoque"("appointmentId");

ALTER TABLE "ReservaEstoque" ADD CONSTRAINT "ReservaEstoque_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservaEstoque" ADD CONSTRAINT "ReservaEstoque_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
