-- Migration: 20260523200000_lead_custom_fields_pipedrive
-- Additive only — no existing data is dropped or modified.

-- ────────────────────────────────────────────────────────────────
-- 1. Add PIPEDRIVE to Platform enum
-- ────────────────────────────────────────────────────────────────
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'PIPEDRIVE';

-- ────────────────────────────────────────────────────────────────
-- 2. Add new columns to Lead
-- ────────────────────────────────────────────────────────────────
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "customFields"       JSONB,
  ADD COLUMN IF NOT EXISTS "pipedrivePersonId"  TEXT,
  ADD COLUMN IF NOT EXISTS "pipedriveDealId"    TEXT;

-- Unique index on pipedrivePersonId (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_pipedrivePersonId_key"
  ON "Lead" ("pipedrivePersonId")
  WHERE "pipedrivePersonId" IS NOT NULL;

-- GIN index for fast JSON field queries
CREATE INDEX IF NOT EXISTS "Lead_customFields_idx"
  ON "Lead" USING GIN ("customFields")
  WHERE "customFields" IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 3. Create LeadCustomFieldDef table
--    Defines which custom fields exist and how to render them.
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LeadCustomFieldDef" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "name"        TEXT        NOT NULL,
  "label"       TEXT        NOT NULL,
  "fieldType"   TEXT        NOT NULL DEFAULT 'text',
  "options"     TEXT[]      NOT NULL DEFAULT ARRAY[]::TEXT[],
  "placeholder" TEXT,
  "required"    BOOLEAN     NOT NULL DEFAULT false,
  "visible"     BOOLEAN     NOT NULL DEFAULT true,
  "sortOrder"   INTEGER     NOT NULL DEFAULT 0,
  "sourceHint"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadCustomFieldDef_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadCustomFieldDef_name_key"
  ON "LeadCustomFieldDef" ("name");

CREATE INDEX IF NOT EXISTS "LeadCustomFieldDef_sortOrder_idx"
  ON "LeadCustomFieldDef" ("sortOrder");

-- ────────────────────────────────────────────────────────────────
-- 4. Trigger to auto-update updatedAt on LeadCustomFieldDef
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "LeadCustomFieldDef_updatedAt" ON "LeadCustomFieldDef";
CREATE TRIGGER "LeadCustomFieldDef_updatedAt"
  BEFORE UPDATE ON "LeadCustomFieldDef"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
