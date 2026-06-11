-- CreateTable: EmailSent (emails enviados via Resend com rastreamento de métricas)

CREATE TABLE "EmailSent" (
  "id"                    TEXT        NOT NULL,
  "leadEmail"             TEXT        NOT NULL,
  "resendId"              TEXT,
  "subject"               TEXT        NOT NULL,
  "fromName"              TEXT,
  "fromEmail"             TEXT,
  "toEmail"               TEXT        NOT NULL,
  "status"                TEXT        NOT NULL DEFAULT 'sent',
  "openedAt"              TIMESTAMP(3),
  "clickedAt"             TIMESTAMP(3),
  "bouncedAt"             TIMESTAMP(3),
  "complainedAt"          TIMESTAMP(3),
  "automationExecutionId" TEXT,
  "automationNodeId"      TEXT,
  "sentAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailSent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSent_resendId_key" ON "EmailSent"("resendId");
CREATE INDEX "EmailSent_leadEmail_idx"  ON "EmailSent"("leadEmail");
CREATE INDEX "EmailSent_status_idx"     ON "EmailSent"("status");
CREATE INDEX "EmailSent_sentAt_idx"     ON "EmailSent"("sentAt");

ALTER TABLE "EmailSent" ADD CONSTRAINT "EmailSent_leadEmail_fkey"
  FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email")
  ON DELETE RESTRICT ON UPDATE CASCADE;
