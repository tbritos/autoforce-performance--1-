-- AlterTable
ALTER TABLE "CampaignEvent"
ADD COLUMN "startDate" DATE,
ADD COLUMN "endDate" DATE,
ADD COLUMN "color" TEXT;

UPDATE "CampaignEvent"
SET "startDate" = "date",
    "endDate" = "date",
    "color" = COALESCE("color", '#2563eb');

ALTER TABLE "CampaignEvent"
ALTER COLUMN "startDate" SET NOT NULL,
ALTER COLUMN "endDate" SET NOT NULL,
ALTER COLUMN "color" SET NOT NULL;

ALTER TABLE "CampaignEvent"
DROP COLUMN "date",
DROP COLUMN "type",
DROP COLUMN "owner";
