-- Recupera a migração-base do módulo de eventos, que havia sido criada por
-- `prisma db push` antes de o histórico versionado existir. Em instalações já
-- existentes as tabelas e o enum permanecem intocados; em bancos novos esta
-- migração cria a base que as migrações seguintes esperam encontrar.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type tipo
    JOIN pg_namespace namespace ON namespace.oid = tipo.typnamespace
    WHERE tipo.typname = 'EventoInscricaoStatus'
      AND namespace.nspname = current_schema()
  ) THEN
    CREATE TYPE "EventoInscricaoStatus" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "Evento" (
  "id" TEXT NOT NULL,
  "titulo" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "conteudo" TEXT NOT NULL,
  "dataInicio" TIMESTAMP(3) NOT NULL,
  "dataFim" TIMESTAMP(3),
  "local" TEXT NOT NULL,
  "endereco" TEXT,
  "imagemUrl" TEXT,
  "preco" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "categoria" TEXT NOT NULL DEFAULT 'Evento',
  "vagas" INTEGER,
  "linkExterno" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "publicado" BOOLEAN NOT NULL DEFAULT false,
  "destaque" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Evento_slug_key" ON "Evento"("slug");
CREATE INDEX IF NOT EXISTS "Evento_publicado_dataInicio_idx"
  ON "Evento"("publicado", "dataInicio");
CREATE INDEX IF NOT EXISTS "Evento_categoria_publicado_idx"
  ON "Evento"("categoria", "publicado");

CREATE TABLE IF NOT EXISTS "EventoInscricao" (
  "id" TEXT NOT NULL,
  "eventoId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "telefone" TEXT NOT NULL,
  "quantidade" INTEGER NOT NULL DEFAULT 1,
  "total" DECIMAL(10,2) NOT NULL,
  "status" "EventoInscricaoStatus" NOT NULL DEFAULT 'PENDENTE',
  "mpPreferenciaId" TEXT,
  "mpPagamentoId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoInscricao_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventoInscricao_eventoId_fkey"
    FOREIGN KEY ("eventoId") REFERENCES "Evento"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EventoInscricao_eventoId_status_idx"
  ON "EventoInscricao"("eventoId", "status");
CREATE INDEX IF NOT EXISTS "EventoInscricao_email_idx"
  ON "EventoInscricao"("email");
