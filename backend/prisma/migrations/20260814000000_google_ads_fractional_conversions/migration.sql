-- Google Ads can attribute fractional conversions (for example 0.5) when
-- data-driven attribution is enabled. Preserve that precision in reports.
ALTER TABLE "CampaignMetrics"
ALTER COLUMN "conversions" TYPE DOUBLE PRECISION
USING "conversions"::DOUBLE PRECISION;
