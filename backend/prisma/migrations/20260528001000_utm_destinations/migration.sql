CREATE TABLE "UTMDestination" (
    "id"        TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UTMDestination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UTMDestination_createdBy_idx" ON "UTMDestination"("createdBy");
CREATE INDEX "UTMDestination_createdAt_idx" ON "UTMDestination"("createdAt");
