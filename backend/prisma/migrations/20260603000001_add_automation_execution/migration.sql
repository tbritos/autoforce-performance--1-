-- CreateTable: AutomationExecution
CREATE TABLE "AutomationExecution" (
    "id"            TEXT NOT NULL,
    "journeyId"     TEXT NOT NULL,
    "leadEmail"     TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'running',
    "currentNodeId" TEXT,
    "resumeAt"      TIMESTAMP(3),
    "log"           JSONB NOT NULL DEFAULT '[]',
    "error"         TEXT,
    "startedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"   TIMESTAMP(3),

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationExecution_status_idx"     ON "AutomationExecution"("status");
CREATE INDEX "AutomationExecution_journeyId_idx"  ON "AutomationExecution"("journeyId");
CREATE INDEX "AutomationExecution_leadEmail_idx"  ON "AutomationExecution"("leadEmail");
CREATE INDEX "AutomationExecution_resumeAt_idx"   ON "AutomationExecution"("resumeAt");
CREATE INDEX "AutomationExecution_startedAt_idx"  ON "AutomationExecution"("startedAt");

-- AddForeignKey
ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_journeyId_fkey"
    FOREIGN KEY ("journeyId") REFERENCES "AutomationJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;
