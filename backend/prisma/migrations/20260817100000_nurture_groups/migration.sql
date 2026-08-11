CREATE TABLE "AutomationNurtureGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 50,
  "canInterruptLowerPriority" BOOLEAN NOT NULL DEFAULT true,
  "queueTtlHours" INTEGER DEFAULT 168,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AutomationNurtureGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AutomationNurtureGroup_name_key"
  ON "AutomationNurtureGroup"("name");

CREATE INDEX "AutomationNurtureGroup_priority_idx"
  ON "AutomationNurtureGroup"("priority");

CREATE INDEX "AutomationNurtureGroup_createdAt_idx"
  ON "AutomationNurtureGroup"("createdAt");

ALTER TABLE "AutomationJourney"
  ADD COLUMN "nurtureGroupId" TEXT;

ALTER TABLE "AutomationExecution"
  ADD COLUMN "nurtureGroupKeySnapshot" TEXT;

-- Execucoes antigas sem grupo continuam isoladas pela propria journey.
UPDATE "AutomationExecution"
SET "nurtureGroupKeySnapshot" = 'journey:' || "journeyId"
WHERE "automationTypeSnapshot" = 'NURTURE'
  AND "nurtureGroupKeySnapshot" IS NULL;

CREATE INDEX "AutomationJourney_nurtureGroupId_idx"
  ON "AutomationJourney"("nurtureGroupId");

CREATE INDEX "AutomationExecution_leadEmail_nurtureGroupKeySnapshot_status_idx"
  ON "AutomationExecution"("leadEmail", "nurtureGroupKeySnapshot", "status");

ALTER TABLE "AutomationJourney"
  ADD CONSTRAINT "AutomationJourney_nurtureGroupId_fkey"
  FOREIGN KEY ("nurtureGroupId") REFERENCES "AutomationNurtureGroup"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- O lock transacional por lead passa a garantir uma unica nutricao LOGICA.
-- Varias execucoes ativas sao permitidas quando compartilham o mesmo grupo.
DROP INDEX IF EXISTS "AutomationExecution_one_active_nurture_per_lead";
