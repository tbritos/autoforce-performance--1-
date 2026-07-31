ALTER TABLE "Lead"
  ADD COLUMN "researchBusinessType" TEXT,
  ADD COLUMN "researchVehicleStock" INTEGER,
  ADD COLUMN "researchEvidence" JSONB,
  ADD COLUMN "researchVisitedUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "researchSiteSource" TEXT;
