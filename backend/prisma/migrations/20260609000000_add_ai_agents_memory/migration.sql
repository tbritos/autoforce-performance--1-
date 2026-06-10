-- AI agents, knowledge base, conversation memory and audit logs.

CREATE TABLE "AIAgent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "objective" TEXT NOT NULL,
  "companyContext" TEXT NOT NULL,
  "salesContext" TEXT NOT NULL,
  "icp" JSONB NOT NULL DEFAULT '{}',
  "qualificationCriteria" JSONB NOT NULL DEFAULT '{}',
  "disqualificationCriteria" JSONB NOT NULL DEFAULT '{}',
  "toneOfVoice" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "safetyRules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "discoveryQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "handoffRules" JSONB NOT NULL DEFAULT '{}',
  "outputSchema" JSONB NOT NULL DEFAULT '{}',
  "defaultProvider" TEXT,
  "defaultModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AIAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIKnowledgeItem" (
  "id" TEXT NOT NULL,
  "agentId" TEXT,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priority" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sourceUrl" TEXT,
  "metadata" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AIKnowledgeItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIConversationMemory" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "leadEmail" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'whatsapp',
  "summary" TEXT,
  "knownFacts" JSONB NOT NULL DEFAULT '{}',
  "pains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "objections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastIntent" TEXT,
  "lastConversationState" TEXT,
  "nextBestAction" TEXT,
  "openQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AIConversationMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIInteractionLog" (
  "id" TEXT NOT NULL,
  "agentId" TEXT,
  "leadEmail" TEXT NOT NULL,
  "journeyId" TEXT,
  "executionId" TEXT,
  "nodeId" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'whatsapp',
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "promptSnapshot" JSONB NOT NULL,
  "response" JSONB NOT NULL,
  "decision" TEXT,
  "confidence" DOUBLE PRECISION,
  "recommendedActions" JSONB NOT NULL DEFAULT '[]',
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AIInteractionLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AIConversationMemory_agentId_leadEmail_channel_key"
  ON "AIConversationMemory"("agentId", "leadEmail", "channel");

CREATE INDEX "AIAgent_isActive_idx" ON "AIAgent"("isActive");
CREATE INDEX "AIAgent_createdAt_idx" ON "AIAgent"("createdAt");

CREATE INDEX "AIKnowledgeItem_agentId_idx" ON "AIKnowledgeItem"("agentId");
CREATE INDEX "AIKnowledgeItem_category_idx" ON "AIKnowledgeItem"("category");
CREATE INDEX "AIKnowledgeItem_isActive_idx" ON "AIKnowledgeItem"("isActive");
CREATE INDEX "AIKnowledgeItem_priority_idx" ON "AIKnowledgeItem"("priority");
CREATE INDEX "AIKnowledgeItem_createdAt_idx" ON "AIKnowledgeItem"("createdAt");

CREATE INDEX "AIConversationMemory_leadEmail_idx" ON "AIConversationMemory"("leadEmail");
CREATE INDEX "AIConversationMemory_agentId_idx" ON "AIConversationMemory"("agentId");
CREATE INDEX "AIConversationMemory_channel_idx" ON "AIConversationMemory"("channel");
CREATE INDEX "AIConversationMemory_updatedAt_idx" ON "AIConversationMemory"("updatedAt");

CREATE INDEX "AIInteractionLog_agentId_idx" ON "AIInteractionLog"("agentId");
CREATE INDEX "AIInteractionLog_leadEmail_idx" ON "AIInteractionLog"("leadEmail");
CREATE INDEX "AIInteractionLog_journeyId_idx" ON "AIInteractionLog"("journeyId");
CREATE INDEX "AIInteractionLog_executionId_idx" ON "AIInteractionLog"("executionId");
CREATE INDEX "AIInteractionLog_decision_idx" ON "AIInteractionLog"("decision");
CREATE INDEX "AIInteractionLog_createdAt_idx" ON "AIInteractionLog"("createdAt");

ALTER TABLE "AIKnowledgeItem"
  ADD CONSTRAINT "AIKnowledgeItem_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "AIAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIConversationMemory"
  ADD CONSTRAINT "AIConversationMemory_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "AIAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIConversationMemory"
  ADD CONSTRAINT "AIConversationMemory_leadEmail_fkey"
  FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIInteractionLog"
  ADD CONSTRAINT "AIInteractionLog_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "AIAgent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AIInteractionLog"
  ADD CONSTRAINT "AIInteractionLog_leadEmail_fkey"
  FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AIInteractionLog"
  ADD CONSTRAINT "AIInteractionLog_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "AutomationJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;
