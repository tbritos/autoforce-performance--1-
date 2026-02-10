-- CreateTable
CREATE TABLE "RdLead" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "conversionIdentifier" TEXT,
    "conversionName" TEXT,
    "lastConversionDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'rdstation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RdLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RdLead_externalId_key" ON "RdLead"("externalId");

-- CreateIndex
CREATE INDEX "RdLead_conversionIdentifier_idx" ON "RdLead"("conversionIdentifier");

-- CreateIndex
CREATE INDEX "RdLead_lastConversionDate_idx" ON "RdLead"("lastConversionDate");
