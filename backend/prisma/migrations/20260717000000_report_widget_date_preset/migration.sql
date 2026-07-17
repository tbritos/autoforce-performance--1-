-- Additive: dynamic date preset for report widgets (e.g. "last_month", "last_quarter"),
-- recalculated at query time instead of a frozen date range.
ALTER TABLE "ReportWidget" ADD COLUMN "datePreset" TEXT;
