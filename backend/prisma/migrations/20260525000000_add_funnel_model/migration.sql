-- AddTable: Funnel
-- Each Funnel defines a named tracking flow filtered by UTM parameters.
-- Leads are matched via first-touch fields (firstSource, firstMedium, firstCampaign, firstLandingPage).

CREATE TABLE "Funnel" (
    "id"               TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "description"      TEXT,
    "color"            TEXT NOT NULL DEFAULT '#3b82f6',
    "filterSource"     TEXT,
    "filterMedium"     TEXT,
    "filterCampaign"   TEXT,
    "filterLandingPage" TEXT,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Funnel_sortOrder_idx" ON "Funnel"("sortOrder");
CREATE INDEX "Funnel_isActive_idx" ON "Funnel"("isActive");
