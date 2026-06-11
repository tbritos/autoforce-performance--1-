-- AlterTable: EmailTemplate — add status, scheduling, audience, design fields

ALTER TABLE "EmailTemplate"
  ADD COLUMN "design"         JSONB,
  ADD COLUMN "status"         TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN "scheduledAt"    TIMESTAMP(3),
  ADD COLUMN "audienceType"   TEXT,
  ADD COLUMN "audienceValue"  TEXT,
  ADD COLUMN "audienceCount"  INTEGER;

CREATE INDEX "EmailTemplate_status_idx" ON "EmailTemplate"("status");
