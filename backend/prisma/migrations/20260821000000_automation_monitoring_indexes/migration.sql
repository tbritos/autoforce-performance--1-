CREATE INDEX IF NOT EXISTS "AutomationExecution_journeyId_isTest_status_idx"
  ON "AutomationExecution"("journeyId", "isTest", "status");

CREATE INDEX IF NOT EXISTS "AutomationExecution_journeyId_isTest_currentNodeId_status_idx"
  ON "AutomationExecution"("journeyId", "isTest", "currentNodeId", "status");

CREATE INDEX IF NOT EXISTS "EmailSent_automationExecutionId_idx"
  ON "EmailSent"("automationExecutionId");

CREATE INDEX IF NOT EXISTS "EmailSent_automationExecutionId_automationNodeId_idx"
  ON "EmailSent"("automationExecutionId", "automationNodeId");
