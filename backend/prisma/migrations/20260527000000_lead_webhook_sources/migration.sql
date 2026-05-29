-- Lead webhook sources: configurable incoming webhooks for Lead Hub.

CREATE TABLE IF NOT EXISTS "LeadWebhookSource" (
  "id"              TEXT NOT NULL,
  "publicId"        TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "description"     TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "securityMode"    TEXT NOT NULL DEFAULT 'SECRET_URL',
  "automaticTags"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "fieldMappings"   JSONB NOT NULL DEFAULT '{}'::JSONB,
  "defaultPersona"  TEXT,
  "defaultPain"     TEXT,
  "defaultSource"   TEXT,
  "defaultCampaign" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LeadWebhookSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadWebhookSource_publicId_key"
  ON "LeadWebhookSource" ("publicId");

CREATE INDEX IF NOT EXISTS "LeadWebhookSource_publicId_idx"
  ON "LeadWebhookSource" ("publicId");

CREATE INDEX IF NOT EXISTS "LeadWebhookSource_isActive_idx"
  ON "LeadWebhookSource" ("isActive");

CREATE INDEX IF NOT EXISTS "LeadWebhookSource_type_idx"
  ON "LeadWebhookSource" ("type");

CREATE INDEX IF NOT EXISTS "LeadWebhookSource_createdAt_idx"
  ON "LeadWebhookSource" ("createdAt");

ALTER TABLE "WebhookLog"
  ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "normalized" JSONB;

CREATE INDEX IF NOT EXISTS "WebhookLog_sourceId_idx"
  ON "WebhookLog" ("sourceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'WebhookLog_sourceId_fkey'
      AND table_name = 'WebhookLog'
  ) THEN
    ALTER TABLE "WebhookLog"
      ADD CONSTRAINT "WebhookLog_sourceId_fkey"
      FOREIGN KEY ("sourceId")
      REFERENCES "LeadWebhookSource" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
