CREATE TABLE IF NOT EXISTS "AutomationJourney" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "nodes" JSONB NOT NULL DEFAULT '[]',
  "edges" JSONB NOT NULL DEFAULT '[]',
  "triggerType" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationJourney_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutomationJourney_status_idx"
  ON "AutomationJourney" ("status");

CREATE INDEX IF NOT EXISTS "AutomationJourney_isActive_idx"
  ON "AutomationJourney" ("isActive");

CREATE INDEX IF NOT EXISTS "AutomationJourney_createdAt_idx"
  ON "AutomationJourney" ("createdAt");
