-- AlterTable: add Pipedrive enrichment fields to RevenueEntry
ALTER TABLE "RevenueEntry"
  ADD COLUMN IF NOT EXISTS "whyBought"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "currentSupplier" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "dealUrl"         TEXT,
  ADD COLUMN IF NOT EXISTS "contractLink"    TEXT;
