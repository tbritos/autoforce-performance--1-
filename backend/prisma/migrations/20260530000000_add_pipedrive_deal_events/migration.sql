-- CreateTable
CREATE TABLE "PipedriveDealEvent" (
    "id"            TEXT NOT NULL,
    "dealId"        TEXT NOT NULL,
    "leadEmail"     TEXT NOT NULL,
    "eventType"     TEXT NOT NULL,
    "fromStageId"   INTEGER,
    "fromStageName" TEXT,
    "toStageId"     INTEGER,
    "toStageName"   TEXT,
    "fromValue"     DOUBLE PRECISION,
    "toValue"       DOUBLE PRECISION,
    "dealTitle"     TEXT,
    "dealStatus"    TEXT NOT NULL,
    "occurredAt"    TIMESTAMP(3) NOT NULL,
    "source"        TEXT NOT NULL DEFAULT 'sync',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipedriveDealEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipedriveDealEvent_leadEmail_idx" ON "PipedriveDealEvent"("leadEmail");

-- CreateIndex
CREATE INDEX "PipedriveDealEvent_dealId_idx" ON "PipedriveDealEvent"("dealId");

-- CreateIndex
CREATE INDEX "PipedriveDealEvent_occurredAt_idx" ON "PipedriveDealEvent"("occurredAt");

-- AddForeignKey
ALTER TABLE "PipedriveDealEvent" ADD CONSTRAINT "PipedriveDealEvent_leadEmail_fkey" FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
