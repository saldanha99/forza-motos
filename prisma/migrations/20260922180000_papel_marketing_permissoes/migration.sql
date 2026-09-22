-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MARKETING';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "permissoes" JSONB NOT NULL DEFAULT '[]';

