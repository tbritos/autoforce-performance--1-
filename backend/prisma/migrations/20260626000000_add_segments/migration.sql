-- CreateTable: Segment — lead segmentation with JSON rules

CREATE TABLE "Segment" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "color"       TEXT NOT NULL DEFAULT '#6366f1',
    "rules"       JSONB NOT NULL,
    "createdBy"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Segment_createdAt_idx" ON "Segment"("createdAt");
