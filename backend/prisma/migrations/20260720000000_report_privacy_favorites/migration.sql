-- Additive: privacy (isPublic, default true — keeps every existing report visible
-- to the whole team exactly as today) and a global favorite flag (isFavorite,
-- mirrors UTMLink.isFavorite) for the Reports feature.
ALTER TABLE "Report" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Report" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Report_createdBy_idx" ON "Report"("createdBy");
CREATE INDEX "Report_isPublic_idx" ON "Report"("isPublic");
CREATE INDEX "Report_isFavorite_idx" ON "Report"("isFavorite");
