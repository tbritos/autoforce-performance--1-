CREATE TABLE IF NOT EXISTS "LeadClassificationRule" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "priority"    INTEGER NOT NULL DEFAULT 100,
  "trigger"     TEXT NOT NULL DEFAULT 'lead_updated',
  "conditions"  JSONB NOT NULL DEFAULT '[]'::JSONB,
  "actions"     JSONB NOT NULL DEFAULT '[]'::JSONB,
  "lastRunAt"   TIMESTAMP(3),
  "runCount"    INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadClassificationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadClassificationRuleExecution" (
  "id"             TEXT NOT NULL,
  "ruleId"         TEXT NOT NULL,
  "leadEmail"      TEXT NOT NULL,
  "matched"        BOOLEAN NOT NULL,
  "actionsApplied" JSONB NOT NULL DEFAULT '[]'::JSONB,
  "error"          TEXT,
  "context"        JSONB,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadClassificationRuleExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadClassificationRule_isActive_idx"
  ON "LeadClassificationRule" ("isActive");
CREATE INDEX IF NOT EXISTS "LeadClassificationRule_priority_idx"
  ON "LeadClassificationRule" ("priority");
CREATE INDEX IF NOT EXISTS "LeadClassificationRule_trigger_idx"
  ON "LeadClassificationRule" ("trigger");
CREATE INDEX IF NOT EXISTS "LeadClassificationRule_createdAt_idx"
  ON "LeadClassificationRule" ("createdAt");

CREATE INDEX IF NOT EXISTS "LeadClassificationRuleExecution_ruleId_idx"
  ON "LeadClassificationRuleExecution" ("ruleId");
CREATE INDEX IF NOT EXISTS "LeadClassificationRuleExecution_leadEmail_idx"
  ON "LeadClassificationRuleExecution" ("leadEmail");
CREATE INDEX IF NOT EXISTS "LeadClassificationRuleExecution_matched_idx"
  ON "LeadClassificationRuleExecution" ("matched");
CREATE INDEX IF NOT EXISTS "LeadClassificationRuleExecution_createdAt_idx"
  ON "LeadClassificationRuleExecution" ("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeadClassificationRuleExecution_ruleId_fkey'
      AND table_name = 'LeadClassificationRuleExecution'
  ) THEN
    ALTER TABLE "LeadClassificationRuleExecution"
      ADD CONSTRAINT "LeadClassificationRuleExecution_ruleId_fkey"
      FOREIGN KEY ("ruleId") REFERENCES "LeadClassificationRule" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
