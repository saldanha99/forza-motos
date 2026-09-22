-- Eventos internos podem ser acessados por um link opaco sem aparecer nas
-- vitrines públicas. O default preserva a visibilidade dos eventos atuais.
ALTER TABLE "Evento"
ADD COLUMN "ocultoListagem" BOOLEAN NOT NULL DEFAULT false;
