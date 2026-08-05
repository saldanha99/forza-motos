-- Módulo independente do evento presencial Pirelli + Forza Motos.
ALTER TYPE "LeadOrigem" ADD VALUE 'EVENTO_PIRELLI';

CREATE TYPE "EventoPirelliOperadorValor" AS ENUM ('MAIOR_QUE', 'MAIOR_OU_IGUAL');
CREATE TYPE "EventoPirelliFotoStatus" AS ENUM ('PENDENTE', 'FINALISTA', 'VENCEDOR', 'DESCARTADO');
CREATE TYPE "EventoPirelliBalanceamentoStatus" AS ENUM ('INTERESSE', 'CONFIRMADO', 'PARTICIPOU');
CREATE TYPE "EventoPirelliOrigemCaneca" AS ENUM ('QUIZ_PERFEITO', 'FOTO_VENCEDORA', 'COMPRA_PNEUS', 'MANUAL');
CREATE TYPE "EventoPirelliCanecaStatus" AS ENUM ('PENDENTE', 'EM_GRAVACAO', 'PRONTA', 'ENTREGUE', 'CANCELADA');
CREATE TYPE "EventoPirelliCompraCanecaStatus" AS ENUM ('PENDENTE', 'EM_GRAVACAO', 'PRONTA', 'ENTREGUE', 'CANCELADA');

CREATE TABLE "EventoPirelli" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL DEFAULT 'pirelli-forza',
  "titulo" TEXT NOT NULL DEFAULT 'Evento Pirelli + Forza Motos',
  "descricao" TEXT,
  "dataInicio" TIMESTAMP(3), "dataFim" TIMESTAMP(3), "local" TEXT,
  "logoForzaUrl" TEXT, "logoPirelliUrl" TEXT, "logoCampneusUrl" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true, "publicado" BOOLEAN NOT NULL DEFAULT false,
  "limiteNomeGravacao" INTEGER NOT NULL DEFAULT 20,
  "valorMinimoPneus" DECIMAL(10,2) NOT NULL DEFAULT 899,
  "operadorValorMinimoPneus" "EventoPirelliOperadorValor" NOT NULL DEFAULT 'MAIOR_QUE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoPirelli_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelli_slug_key" ON "EventoPirelli"("slug");
CREATE INDEX "EventoPirelli_ativo_publicado_idx" ON "EventoPirelli"("ativo", "publicado");

CREATE TABLE "EventoPirelliVisitante" (
  "id" TEXT NOT NULL, "eventoId" TEXT NOT NULL, "nomeCompleto" TEXT NOT NULL,
  "nomeGravacao" TEXT NOT NULL, "nomeGravacaoConfirmadoEm" TIMESTAMP(3) NOT NULL,
  "whatsapp" TEXT NOT NULL, "email" TEXT, "instagram" TEXT, "consentimentoMarketingEm" TIMESTAMP(3),
  "chaveSubmissao" TEXT NOT NULL, "codigoQr" TEXT NOT NULL, "crmLeadId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoPirelliVisitante_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelliVisitante_chaveSubmissao_key" ON "EventoPirelliVisitante"("chaveSubmissao");
CREATE UNIQUE INDEX "EventoPirelliVisitante_codigoQr_key" ON "EventoPirelliVisitante"("codigoQr");
CREATE UNIQUE INDEX "EventoPirelliVisitante_eventoId_whatsapp_key" ON "EventoPirelliVisitante"("eventoId", "whatsapp");
CREATE INDEX "EventoPirelliVisitante_eventoId_createdAt_idx" ON "EventoPirelliVisitante"("eventoId", "createdAt");
ALTER TABLE "EventoPirelliVisitante" ADD CONSTRAINT "EventoPirelliVisitante_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoPirelli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliQuizPergunta" (
  "id" TEXT NOT NULL, "eventoId" TEXT NOT NULL, "enunciado" TEXT NOT NULL, "explicacao" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0, "pontos" INTEGER NOT NULL DEFAULT 1, "ativa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoPirelliQuizPergunta_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventoPirelliQuizPergunta_eventoId_ativa_ordem_idx" ON "EventoPirelliQuizPergunta"("eventoId", "ativa", "ordem");
ALTER TABLE "EventoPirelliQuizPergunta" ADD CONSTRAINT "EventoPirelliQuizPergunta_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoPirelli"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliQuizOpcao" (
  "id" TEXT NOT NULL, "perguntaId" TEXT NOT NULL, "texto" TEXT NOT NULL, "correta" BOOLEAN NOT NULL DEFAULT false,
  "ordem" INTEGER NOT NULL DEFAULT 0, "ativa" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoPirelliQuizOpcao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventoPirelliQuizOpcao_perguntaId_ordem_idx" ON "EventoPirelliQuizOpcao"("perguntaId", "ordem");
ALTER TABLE "EventoPirelliQuizOpcao" ADD CONSTRAINT "EventoPirelliQuizOpcao_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "EventoPirelliQuizPergunta"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliQuizTentativa" (
  "id" TEXT NOT NULL, "visitanteId" TEXT NOT NULL, "pontuacao" INTEGER NOT NULL, "pontuacaoMaxima" INTEGER NOT NULL,
  "acertouTodas" BOOLEAN NOT NULL DEFAULT false, "concluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoPirelliQuizTentativa_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelliQuizTentativa_visitanteId_key" ON "EventoPirelliQuizTentativa"("visitanteId");
ALTER TABLE "EventoPirelliQuizTentativa" ADD CONSTRAINT "EventoPirelliQuizTentativa_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliQuizResposta" (
  "id" TEXT NOT NULL, "tentativaId" TEXT NOT NULL, "perguntaId" TEXT NOT NULL, "opcaoId" TEXT NOT NULL,
  "enunciadoSnapshot" TEXT NOT NULL, "opcaoSnapshot" TEXT NOT NULL, "corretaSnapshot" BOOLEAN NOT NULL, "pontosGanhos" INTEGER NOT NULL,
  CONSTRAINT "EventoPirelliQuizResposta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelliQuizResposta_tentativaId_perguntaId_key" ON "EventoPirelliQuizResposta"("tentativaId", "perguntaId");
ALTER TABLE "EventoPirelliQuizResposta" ADD CONSTRAINT "EventoPirelliQuizResposta_tentativaId_fkey" FOREIGN KEY ("tentativaId") REFERENCES "EventoPirelliQuizTentativa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoPirelliQuizResposta" ADD CONSTRAINT "EventoPirelliQuizResposta_perguntaId_fkey" FOREIGN KEY ("perguntaId") REFERENCES "EventoPirelliQuizPergunta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoPirelliQuizResposta" ADD CONSTRAINT "EventoPirelliQuizResposta_opcaoId_fkey" FOREIGN KEY ("opcaoId") REFERENCES "EventoPirelliQuizOpcao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliParticipacaoFoto" (
  "id" TEXT NOT NULL, "visitanteId" TEXT NOT NULL, "instagram" TEXT NOT NULL,
  "declarouPublicacaoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "declarouMarcacoes" BOOLEAN NOT NULL DEFAULT false,
  "status" "EventoPirelliFotoStatus" NOT NULL DEFAULT 'PENDENTE', "curtidasApuradas" INTEGER,
  "apuradoEm" TIMESTAMP(3), "apuradoPor" TEXT, "observacao" TEXT,
  CONSTRAINT "EventoPirelliParticipacaoFoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelliParticipacaoFoto_visitanteId_key" ON "EventoPirelliParticipacaoFoto"("visitanteId");
ALTER TABLE "EventoPirelliParticipacaoFoto" ADD CONSTRAINT "EventoPirelliParticipacaoFoto_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliBalanceamento" (
  "id" TEXT NOT NULL, "visitanteId" TEXT NOT NULL, "horarioPreferido" TEXT,
  "status" "EventoPirelliBalanceamentoStatus" NOT NULL DEFAULT 'INTERESSE', "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoPirelliBalanceamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelliBalanceamento_visitanteId_key" ON "EventoPirelliBalanceamento"("visitanteId");
ALTER TABLE "EventoPirelliBalanceamento" ADD CONSTRAINT "EventoPirelliBalanceamento_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliCaneca" (
  "id" TEXT NOT NULL, "visitanteId" TEXT NOT NULL, "nomeGravacaoSnapshot" TEXT NOT NULL,
  "status" "EventoPirelliCanecaStatus" NOT NULL DEFAULT 'PENDENTE', "gravacaoIniciadaEm" TIMESTAMP(3),
  "gravadoPor" TEXT, "prontaEm" TIMESTAMP(3), "entregueEm" TIMESTAMP(3), "entreguePor" TEXT,
  "observacao" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventoPirelliCaneca_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelliCaneca_visitanteId_key" ON "EventoPirelliCaneca"("visitanteId");
CREATE INDEX "EventoPirelliCaneca_status_createdAt_idx" ON "EventoPirelliCaneca"("status", "createdAt");
ALTER TABLE "EventoPirelliCaneca" ADD CONSTRAINT "EventoPirelliCaneca_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliElegibilidadeCaneca" (
  "id" TEXT NOT NULL, "visitanteId" TEXT NOT NULL, "origem" "EventoPirelliOrigemCaneca" NOT NULL, "canecaId" TEXT,
  "valorPneus" DECIMAL(10,2), "referenciaVenda" TEXT, "observacao" TEXT,
  "validadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "validadoPor" TEXT,
  CONSTRAINT "EventoPirelliElegibilidadeCaneca_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventoPirelliElegibilidadeCaneca_visitanteId_origem_key" ON "EventoPirelliElegibilidadeCaneca"("visitanteId", "origem");
CREATE INDEX "EventoPirelliElegibilidadeCaneca_origem_validadoEm_idx" ON "EventoPirelliElegibilidadeCaneca"("origem", "validadoEm");
ALTER TABLE "EventoPirelliElegibilidadeCaneca" ADD CONSTRAINT "EventoPirelliElegibilidadeCaneca_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoPirelliElegibilidadeCaneca" ADD CONSTRAINT "EventoPirelliElegibilidadeCaneca_canecaId_fkey" FOREIGN KEY ("canecaId") REFERENCES "EventoPirelliCaneca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EventoPirelliCompraCaneca" (
  "id" TEXT NOT NULL, "eventoId" TEXT NOT NULL, "visitanteId" TEXT, "quantidade" INTEGER NOT NULL DEFAULT 1,
  "nomeGravacaoSnapshot" TEXT NOT NULL, "referenciaVenda" TEXT,
  "status" "EventoPirelliCompraCanecaStatus" NOT NULL DEFAULT 'PENDENTE', "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entregueEm" TIMESTAMP(3), "entreguePor" TEXT, "observacao" TEXT,
  CONSTRAINT "EventoPirelliCompraCaneca_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EventoPirelliCompraCaneca_eventoId_status_registradoEm_idx" ON "EventoPirelliCompraCaneca"("eventoId", "status", "registradoEm");
ALTER TABLE "EventoPirelliCompraCaneca" ADD CONSTRAINT "EventoPirelliCompraCaneca_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "EventoPirelli"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoPirelliCompraCaneca" ADD CONSTRAINT "EventoPirelliCompraCaneca_visitanteId_fkey" FOREIGN KEY ("visitanteId") REFERENCES "EventoPirelliVisitante"("id") ON DELETE SET NULL ON UPDATE CASCADE;
