CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "leadEmail" TEXT,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "status" TEXT NOT NULL DEFAULT 'received',
    "messageId" TEXT,
    "repliedToMessageId" TEXT,
    "automationJourneyId" TEXT,
    "automationExecutionId" TEXT,
    "templateName" TEXT,
    "text" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppMessage_messageId_key" ON "WhatsAppMessage"("messageId");
CREATE INDEX "WhatsAppMessage_leadId_idx" ON "WhatsAppMessage"("leadId");
CREATE INDEX "WhatsAppMessage_leadEmail_idx" ON "WhatsAppMessage"("leadEmail");
CREATE INDEX "WhatsAppMessage_phone_idx" ON "WhatsAppMessage"("phone");
CREATE INDEX "WhatsAppMessage_messageId_idx" ON "WhatsAppMessage"("messageId");
CREATE INDEX "WhatsAppMessage_automationJourneyId_idx" ON "WhatsAppMessage"("automationJourneyId");
CREATE INDEX "WhatsAppMessage_automationExecutionId_idx" ON "WhatsAppMessage"("automationExecutionId");
CREATE INDEX "WhatsAppMessage_createdAt_idx" ON "WhatsAppMessage"("createdAt");
