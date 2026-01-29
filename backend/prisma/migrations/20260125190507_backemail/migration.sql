-- CreateTable
CREATE TABLE "WorkflowEmailStat" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "workflowId" TEXT,
    "workflowName" TEXT NOT NULL,
    "emailName" TEXT NOT NULL,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,
    "deliveredRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openedRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickedRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spamRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'rd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowEmailStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowEmailStat_externalId_source_key" ON "WorkflowEmailStat"("externalId", "source");
