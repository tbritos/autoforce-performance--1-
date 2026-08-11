ALTER TABLE "AutomationJourney"
  ADD COLUMN "automationType" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN "entryMode" TEXT NOT NULL DEFAULT 'TRIGGER',
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "canInterruptLowerPriority" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "queueTtlHours" INTEGER NOT NULL DEFAULT 168;

ALTER TABLE "AutomationExecution"
  ADD COLUMN "automationTypeSnapshot" TEXT NOT NULL DEFAULT 'STANDALONE',
  ADD COLUMN "prioritySnapshot" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "triggerEvent" TEXT,
  ADD COLUMN "triggerContext" JSONB,
  ADD COLUMN "queuedAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "supersededById" TEXT,
  ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "AutomationExecution_leadEmail_status_idx"
  ON "AutomationExecution"("leadEmail", "status");

CREATE INDEX "AutomationExecution_status_queuedAt_idx"
  ON "AutomationExecution"("status", "queuedAt");

-- A garantia principal precisa estar no PostgreSQL, nao somente em memoria:
-- mesmo com dois processos/eventos simultaneos, um lead tem uma unica nutricao ativa.
CREATE UNIQUE INDEX "AutomationExecution_one_active_nurture_per_lead"
  ON "AutomationExecution" (lower("leadEmail"))
  WHERE "automationTypeSnapshot" = 'NURTURE'
    AND "isTest" = false
    AND "status" IN ('running', 'waiting');

-- Webhooks repetidos nao empilham a mesma jornada varias vezes para o mesmo lead.
CREATE UNIQUE INDEX "AutomationExecution_one_queued_journey_per_lead"
  ON "AutomationExecution" (lower("leadEmail"), "journeyId")
  WHERE "automationTypeSnapshot" = 'NURTURE'
    AND "isTest" = false
    AND "status" = 'queued';
