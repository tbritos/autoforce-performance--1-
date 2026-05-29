-- ============================================================
-- Phase 1: Lead Foundation — AutoForce Marketing Hub
-- Date: 2026-05-23
--
-- Strategy: Purely additive. No existing column is renamed,
-- altered, or dropped. All new columns on existing tables are
-- nullable or carry defaults so existing rows are unaffected.
-- New tables are created from scratch.
-- ============================================================

-- ============================================================
-- STEP 1: Create Enum Types (used by new tables only)
-- ============================================================

CREATE TYPE "LeadStatus" AS ENUM (
  'LEAD',
  'MQL',
  'SQL',
  'OPPORTUNITY',
  'CLIENT',
  'LOST',
  'DISQUALIFIED'
);

CREATE TYPE "Platform" AS ENUM (
  'META_ADS',
  'GOOGLE_ADS',
  'GOOGLE_ANALYTICS',
  'RD_STATION',
  'GOOGLE_CALENDAR'
);

CREATE TYPE "ConnectionStatus" AS ENUM (
  'CONNECTED',
  'DISCONNECTED',
  'ERROR',
  'EXPIRED'
);

-- ============================================================
-- STEP 2: Create New Tables
-- ============================================================

-- PlatformConnection must come before Campaign (Campaign FKs it)
CREATE TABLE "PlatformConnection" (
    "id"             TEXT NOT NULL,
    "platform"       "Platform" NOT NULL,
    "status"         "ConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "accountId"      TEXT,
    "accountName"    TEXT,
    "extraIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "accessToken"    TEXT,
    "refreshToken"   TEXT,
    "tokenExpiry"    TIMESTAMP(3),
    "metadata"       JSONB,
    "lastSyncAt"     TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError"  TEXT,
    "syncCount"      INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformConnection_platform_key" ON "PlatformConnection"("platform");

-- Lead: central entity — email is the natural, unique key
CREATE TABLE "Lead" (
    "id"               TEXT NOT NULL,
    "email"            TEXT NOT NULL,
    "name"             TEXT,
    "phone"            TEXT,
    "company"          TEXT,
    "jobTitle"         TEXT,
    "city"             TEXT,
    "state"            TEXT,
    "status"           "LeadStatus" NOT NULL DEFAULT 'LEAD',
    "firstSource"      TEXT,
    "firstMedium"      TEXT,
    "firstCampaign"    TEXT,
    "firstLandingPage" TEXT,
    "score"            INTEGER NOT NULL DEFAULT 0,
    "isHot"            BOOLEAN NOT NULL DEFAULT false,
    "tags"             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notes"            TEXT,
    "assignedTo"       TEXT,
    "firstSeenAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt"      TIMESTAMP(3),
    "convertedAt"      TIMESTAMP(3),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,
    "deletedAt"        TIMESTAMP(3),

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Lead_email_key"      ON "Lead"("email");
CREATE INDEX "Lead_status_idx"            ON "Lead"("status");
CREATE INDEX "Lead_firstSource_idx"       ON "Lead"("firstSource");
CREATE INDEX "Lead_isHot_idx"             ON "Lead"("isHot");
CREATE INDEX "Lead_score_idx"             ON "Lead"("score");
CREATE INDEX "Lead_assignedTo_idx"        ON "Lead"("assignedTo");
CREATE INDEX "Lead_lastSeenAt_idx"        ON "Lead"("lastSeenAt");
CREATE INDEX "Lead_createdAt_idx"         ON "Lead"("createdAt");
CREATE INDEX "Lead_deletedAt_idx"         ON "Lead"("deletedAt");

-- LeadConversion: immutable record of each lead touchpoint
CREATE TABLE "LeadConversion" (
    "id"           TEXT NOT NULL,
    "leadEmail"    TEXT NOT NULL,
    "source"       TEXT NOT NULL,
    "externalId"   TEXT,
    "campaignId"   TEXT,
    "campaignName" TEXT,
    "formName"     TEXT,
    "landingPage"  TEXT,
    "utmSource"    TEXT,
    "utmMedium"    TEXT,
    "utmCampaign"  TEXT,
    "utmContent"   TEXT,
    "utmTerm"      TEXT,
    "rawData"      JSONB NOT NULL,
    "convertedAt"  TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadConversion_externalId_source_key" ON "LeadConversion"("externalId", "source");
CREATE INDEX "LeadConversion_leadEmail_idx"   ON "LeadConversion"("leadEmail");
CREATE INDEX "LeadConversion_source_idx"      ON "LeadConversion"("source");
CREATE INDEX "LeadConversion_campaignId_idx"  ON "LeadConversion"("campaignId");
CREATE INDEX "LeadConversion_convertedAt_idx" ON "LeadConversion"("convertedAt");
CREATE INDEX "LeadConversion_utmCampaign_idx" ON "LeadConversion"("utmCampaign");
CREATE INDEX "LeadConversion_utmSource_idx"   ON "LeadConversion"("utmSource");

-- LeadStatusHistory: audit trail — one row per funnel transition
CREATE TABLE "LeadStatusHistory" (
    "id"         TEXT NOT NULL,
    "leadEmail"  TEXT NOT NULL,
    "fromStatus" "LeadStatus",
    "toStatus"   "LeadStatus" NOT NULL,
    "changedBy"  TEXT,
    "reason"     TEXT,
    "changedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadStatusHistory_leadEmail_idx" ON "LeadStatusHistory"("leadEmail");
CREATE INDEX "LeadStatusHistory_changedAt_idx" ON "LeadStatusHistory"("changedAt");

-- CampaignMetrics: daily immutable snapshot per campaign
CREATE TABLE "CampaignMetrics" (
    "id"              TEXT NOT NULL,
    "campaignId"      TEXT NOT NULL,
    "date"            DATE NOT NULL,
    "impressions"     INTEGER NOT NULL DEFAULT 0,
    "reach"           INTEGER NOT NULL DEFAULT 0,
    "clicks"          INTEGER NOT NULL DEFAULT 0,
    "ctr"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spend"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpl"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leads"           INTEGER NOT NULL DEFAULT 0,
    "conversions"     INTEGER NOT NULL DEFAULT 0,
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "videoViews"      INTEGER,
    "videoWatchPct"   DOUBLE PRECISION,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignMetrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignMetrics_campaignId_date_key" ON "CampaignMetrics"("campaignId", "date");
CREATE INDEX "CampaignMetrics_campaignId_idx" ON "CampaignMetrics"("campaignId");
CREATE INDEX "CampaignMetrics_date_idx"       ON "CampaignMetrics"("date");

-- UTMLink: generated tracking links for the UTM Tracker feature
CREATE TABLE "UTMLink" (
    "id"             TEXT NOT NULL,
    "createdBy"      TEXT NOT NULL,
    "title"          TEXT,
    "destinationUrl" TEXT NOT NULL,
    "fullUrl"        TEXT NOT NULL,
    "shortUrl"       TEXT,
    "shortCode"      TEXT,
    "utmSource"      TEXT NOT NULL,
    "utmMedium"      TEXT NOT NULL,
    "utmCampaign"    TEXT NOT NULL,
    "utmContent"     TEXT,
    "utmTerm"        TEXT,
    "campaignId"     TEXT,
    "clicks"         INTEGER NOT NULL DEFAULT 0,
    "isTemplate"     BOOLEAN NOT NULL DEFAULT false,
    "templateName"   TEXT,
    "isFavorite"     BOOLEAN NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "deletedAt"      TIMESTAMP(3),

    CONSTRAINT "UTMLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UTMLink_shortCode_key"    ON "UTMLink"("shortCode") WHERE "shortCode" IS NOT NULL;
CREATE INDEX "UTMLink_createdBy_idx"           ON "UTMLink"("createdBy");
CREATE INDEX "UTMLink_utmCampaign_idx"         ON "UTMLink"("utmCampaign");
CREATE INDEX "UTMLink_campaignId_idx"          ON "UTMLink"("campaignId");
CREATE INDEX "UTMLink_isTemplate_idx"          ON "UTMLink"("isTemplate");
CREATE INDEX "UTMLink_isFavorite_idx"          ON "UTMLink"("isFavorite");
CREATE INDEX "UTMLink_createdAt_idx"           ON "UTMLink"("createdAt");
CREATE INDEX "UTMLink_deletedAt_idx"           ON "UTMLink"("deletedAt");

-- WebhookLog: raw audit of every inbound webhook before processing
CREATE TABLE "WebhookLog" (
    "id"          TEXT NOT NULL,
    "source"      TEXT NOT NULL,
    "payload"     JSONB NOT NULL,
    "status"      TEXT NOT NULL,
    "leadEmail"   TEXT,
    "error"       TEXT,
    "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookLog_source_idx"     ON "WebhookLog"("source");
CREATE INDEX "WebhookLog_status_idx"     ON "WebhookLog"("status");
CREATE INDEX "WebhookLog_receivedAt_idx" ON "WebhookLog"("receivedAt");
CREATE INDEX "WebhookLog_leadEmail_idx"  ON "WebhookLog"("leadEmail");

-- ============================================================
-- STEP 3: Foreign Key Constraints — New Tables
-- ============================================================

ALTER TABLE "LeadConversion"
    ADD CONSTRAINT "LeadConversion_leadEmail_fkey"
    FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadConversion"
    ADD CONSTRAINT "LeadConversion_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadStatusHistory"
    ADD CONSTRAINT "LeadStatusHistory_leadEmail_fkey"
    FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CampaignMetrics"
    ADD CONSTRAINT "CampaignMetrics_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UTMLink"
    ADD CONSTRAINT "UTMLink_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "User"("email")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UTMLink"
    ADD CONSTRAINT "UTMLink_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- STEP 4: Add Columns to Existing Tables (additive only)
-- ============================================================

-- User -------------------------------------------------------
ALTER TABLE "User"
    ADD COLUMN "isActive"    BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- RevenueEntry -----------------------------------------------
ALTER TABLE "RevenueEntry"
    ADD COLUMN "leadEmail"   TEXT,
    ADD COLUMN "originType"  TEXT NOT NULL DEFAULT 'INBOUND',
    ADD COLUMN "closedBy"    TEXT;

CREATE INDEX "RevenueEntry_date_idx"       ON "RevenueEntry"("date");
CREATE INDEX "RevenueEntry_leadEmail_idx"  ON "RevenueEntry"("leadEmail");
CREATE INDEX "RevenueEntry_originType_idx" ON "RevenueEntry"("originType");
CREATE INDEX "RevenueEntry_closedBy_idx"   ON "RevenueEntry"("closedBy");

-- OKR --------------------------------------------------------
ALTER TABLE "OKR"
    ADD COLUMN "year"   INTEGER,
    ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ON_TRACK';

-- Backfill year from quarter field (format: "Q1 2026")
UPDATE "OKR"
SET "year" = CAST(SPLIT_PART("quarter", ' ', 2) AS INTEGER)
WHERE "quarter" ~ '^Q[1-4] [0-9]{4}$';

CREATE INDEX "OKR_year_idx"    ON "OKR"("year");
CREATE INDEX "OKR_quarter_idx" ON "OKR"("quarter");

-- TeamMember -------------------------------------------------
ALTER TABLE "TeamMember"
    ADD COLUMN "email" TEXT;

-- Partial unique index: multiple NULLs allowed, but non-NULL values must be unique
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email") WHERE "email" IS NOT NULL;

-- LandingPage ------------------------------------------------
ALTER TABLE "LandingPage"
    ADD COLUMN "sessions"            INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "avgSessionDuration"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "lastSyncAt"          TIMESTAMP(3);

CREATE INDEX "LandingPage_conversions_idx" ON "LandingPage"("conversions");
CREATE INDEX "LandingPage_lastSyncAt_idx"  ON "LandingPage"("lastSyncAt");

-- CampaignEvent ----------------------------------------------
ALTER TABLE "CampaignEvent"
    ADD COLUMN "description" TEXT,
    ADD COLUMN "type"        TEXT NOT NULL DEFAULT 'CAMPAIGN',
    ADD COLUMN "campaignId"  TEXT,
    ADD COLUMN "externalId"  TEXT;

CREATE INDEX "CampaignEvent_startDate_idx"  ON "CampaignEvent"("startDate");
CREATE INDEX "CampaignEvent_type_idx"       ON "CampaignEvent"("type");
CREATE INDEX "CampaignEvent_campaignId_idx" ON "CampaignEvent"("campaignId");

-- Campaign ---------------------------------------------------
ALTER TABLE "Campaign"
    ADD COLUMN "objective"           TEXT,
    ADD COLUMN "dailyBudget"         DOUBLE PRECISION,
    ADD COLUMN "externalId"          TEXT,
    ADD COLUMN "platformConnectionId" TEXT,
    ADD COLUMN "deletedAt"           TIMESTAMP(3);

CREATE INDEX "Campaign_platform_idx"             ON "Campaign"("platform");
CREATE INDEX "Campaign_status_idx"               ON "Campaign"("status");
CREATE INDEX "Campaign_externalId_idx"           ON "Campaign"("externalId");
CREATE INDEX "Campaign_platformConnectionId_idx" ON "Campaign"("platformConnectionId");
CREATE INDEX "Campaign_startDate_idx"            ON "Campaign"("startDate");
CREATE INDEX "Campaign_deletedAt_idx"            ON "Campaign"("deletedAt");

-- AssetItem --------------------------------------------------
ALTER TABLE "AssetItem"
    ADD COLUMN "campaignId" TEXT,
    ADD COLUMN "deletedAt"  TIMESTAMP(3);

CREATE INDEX "AssetItem_category_idx"  ON "AssetItem"("category");
CREATE INDEX "AssetItem_campaignId_idx" ON "AssetItem"("campaignId");
CREATE INDEX "AssetItem_deletedAt_idx" ON "AssetItem"("deletedAt");

-- AssetVersion -----------------------------------------------
ALTER TABLE "AssetVersion"
    ADD COLUMN "notes" TEXT;

-- EmailCampaign ----------------------------------------------
ALTER TABLE "EmailCampaign"
    ADD COLUMN "platformConnectionId" TEXT,
    ADD COLUMN "unsubscribes"         INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "EmailCampaign_date_idx"   ON "EmailCampaign"("date");
CREATE INDEX "EmailCampaign_source_idx" ON "EmailCampaign"("source");

-- SyncLog ----------------------------------------------------
ALTER TABLE "SyncLog"
    ADD COLUMN "platformConnectionId" TEXT,
    ADD COLUMN "recordsProcessed"     INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "SyncLog_status_idx"               ON "SyncLog"("status");
CREATE INDEX "SyncLog_platformConnectionId_idx" ON "SyncLog"("platformConnectionId");

-- DailyLead --------------------------------------------------
ALTER TABLE "DailyLead"
    ADD COLUMN "notes" TEXT;

CREATE INDEX "DailyLead_date_idx" ON "DailyLead"("date");

-- WebhookLead (RdLead) — add phone/company if not present from previous migration
-- These may already exist from migration 20260211193000 — skip if so
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'RdLead' AND column_name = 'phone'
    ) THEN
        ALTER TABLE "RdLead" ADD COLUMN "phone" TEXT;
        ALTER TABLE "RdLead" ADD COLUMN "company" TEXT;
    END IF;
END $$;

-- ============================================================
-- STEP 5: FK Constraints for New Columns on Existing Tables
-- ============================================================

ALTER TABLE "Campaign"
    ADD CONSTRAINT "Campaign_platformConnectionId_fkey"
    FOREIGN KEY ("platformConnectionId") REFERENCES "PlatformConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailCampaign"
    ADD CONSTRAINT "EmailCampaign_platformConnectionId_fkey"
    FOREIGN KEY ("platformConnectionId") REFERENCES "PlatformConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SyncLog"
    ADD CONSTRAINT "SyncLog_platformConnectionId_fkey"
    FOREIGN KEY ("platformConnectionId") REFERENCES "PlatformConnection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RevenueEntry"
    ADD CONSTRAINT "RevenueEntry_leadEmail_fkey"
    FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email")
    ON DELETE SET NULL ON UPDATE CASCADE;
