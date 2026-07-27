-- Regras de pontuacao automatica aplicadas a todo lead novo que entra no
-- sistema. Migracao aditiva, cria uma tabela nova, nao mexe em dado existente.

CREATE TABLE "LeadScoringRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logic" TEXT NOT NULL DEFAULT 'AND',
    "conditions" JSONB NOT NULL,
    "points" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadScoringRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadScoringRule_isActive_idx" ON "LeadScoringRule"("isActive");
