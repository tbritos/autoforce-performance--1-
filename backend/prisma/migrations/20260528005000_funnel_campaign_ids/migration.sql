-- Link campaigns to funnels for ad spend attribution
ALTER TABLE "Funnel" ADD COLUMN IF NOT EXISTS "campaignIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
