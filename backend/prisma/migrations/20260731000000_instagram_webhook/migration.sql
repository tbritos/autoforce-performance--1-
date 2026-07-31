-- Store raw Instagram webhook events idempotently and normalize messages for AutoChat.
CREATE TABLE "InstagramWebhookEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "accountId" TEXT,
    "senderId" TEXT,
    "recipientId" TEXT,
    "messageId" TEXT,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstagramMessage" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'message',
    "status" TEXT NOT NULL DEFAULT 'received',
    "text" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstagramMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstagramWebhookEvent_eventKey_key" ON "InstagramWebhookEvent"("eventKey");
CREATE INDEX "InstagramWebhookEvent_accountId_idx" ON "InstagramWebhookEvent"("accountId");
CREATE INDEX "InstagramWebhookEvent_eventType_idx" ON "InstagramWebhookEvent"("eventType");
CREATE INDEX "InstagramWebhookEvent_messageId_idx" ON "InstagramWebhookEvent"("messageId");
CREATE INDEX "InstagramWebhookEvent_createdAt_idx" ON "InstagramWebhookEvent"("createdAt");

CREATE UNIQUE INDEX "InstagramMessage_messageId_key" ON "InstagramMessage"("messageId");
CREATE INDEX "InstagramMessage_accountId_idx" ON "InstagramMessage"("accountId");
CREATE INDEX "InstagramMessage_senderId_idx" ON "InstagramMessage"("senderId");
CREATE INDEX "InstagramMessage_recipientId_idx" ON "InstagramMessage"("recipientId");
CREATE INDEX "InstagramMessage_direction_idx" ON "InstagramMessage"("direction");
CREATE INDEX "InstagramMessage_createdAt_idx" ON "InstagramMessage"("createdAt");
