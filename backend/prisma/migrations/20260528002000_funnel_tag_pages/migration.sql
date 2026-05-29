-- Add tag-based funnel membership and GA4 impression pages
ALTER TABLE "Funnel" ADD COLUMN IF NOT EXISTS "impressionPages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Funnel" ADD COLUMN IF NOT EXISTS "leadTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
