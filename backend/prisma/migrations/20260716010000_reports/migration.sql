-- CreateTable: Report + ReportWidget — relatórios customizáveis montados pelo usuário.
-- Dado dos widgets nunca é persistido, só a definição (métrica/filtros/layout).

CREATE TYPE "ReportWidgetType" AS ENUM (
  'KPI_CARD',
  'LINE_CHART',
  'BAR_CHART',
  'PIE_CHART',
  'TABLE'
);

CREATE TABLE "Report" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "description" TEXT,
  "layout"      JSONB NOT NULL,
  "createdBy"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReportWidget" (
  "id"        TEXT NOT NULL,
  "reportId"  TEXT NOT NULL,
  "type"      "ReportWidgetType" NOT NULL,
  "title"     TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "groupBy"   TEXT,
  "filters"   JSONB,
  "dateFrom"  TIMESTAMP(3),
  "dateTo"    TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReportWidget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_createdAt_idx" ON "Report"("createdAt");
CREATE INDEX "ReportWidget_reportId_idx" ON "ReportWidget"("reportId");

ALTER TABLE "ReportWidget" ADD CONSTRAINT "ReportWidget_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
