-- Track Meta data-deletion confirmations without retaining the requesting user ID.
CREATE TABLE "InstagramDataDeletionRequest" (
    "id" TEXT NOT NULL,
    "confirmationCode" TEXT NOT NULL,
    "userIdHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "deletedEventCount" INTEGER NOT NULL DEFAULT 0,
    "deletedMessageCount" INTEGER NOT NULL DEFAULT 0,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "InstagramDataDeletionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstagramDataDeletionRequest_confirmationCode_key"
ON "InstagramDataDeletionRequest"("confirmationCode");

CREATE INDEX "InstagramDataDeletionRequest_status_idx"
ON "InstagramDataDeletionRequest"("status");

CREATE INDEX "InstagramDataDeletionRequest_requestedAt_idx"
ON "InstagramDataDeletionRequest"("requestedAt");
