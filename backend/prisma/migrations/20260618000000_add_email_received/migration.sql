-- CreateTable: EmailReceived (emails recebidos via Resend Inbound)

CREATE TABLE "EmailReceived" (
  "id"         TEXT NOT NULL,
  "leadEmail"  TEXT NOT NULL,
  "resendId"   TEXT,
  "fromEmail"  TEXT NOT NULL,
  "fromName"   TEXT,
  "toEmail"    TEXT,
  "subject"    TEXT,
  "text"       TEXT,
  "html"       TEXT,
  "rawData"    JSONB NOT NULL DEFAULT '{}',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailReceived_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailReceived_resendId_key" ON "EmailReceived"("resendId");
CREATE INDEX "EmailReceived_leadEmail_idx" ON "EmailReceived"("leadEmail");
CREATE INDEX "EmailReceived_fromEmail_idx" ON "EmailReceived"("fromEmail");
CREATE INDEX "EmailReceived_receivedAt_idx" ON "EmailReceived"("receivedAt");

ALTER TABLE "EmailReceived" ADD CONSTRAINT "EmailReceived_leadEmail_fkey"
  FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email")
  ON DELETE RESTRICT ON UPDATE CASCADE;
