-- AlterTable: adiciona campos seoTitle e nicho ao GlossaryTerm
ALTER TABLE "GlossaryTerm" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;
ALTER TABLE "GlossaryTerm" ADD COLUMN IF NOT EXISTS "nicho" TEXT;
