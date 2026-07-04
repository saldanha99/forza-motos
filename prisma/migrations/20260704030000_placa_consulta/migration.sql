-- Cache de consultas de placa (API paga — evita consulta repetida)
CREATE TABLE "PlacaConsulta" (
    "placa" TEXT NOT NULL,
    "resposta" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacaConsulta_pkey" PRIMARY KEY ("placa")
);
