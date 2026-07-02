-- CreateTable: EmailBlast — disparo avulso de email (segmento / tag / individual), fora de automacao

CREATE TABLE "EmailBlast" (
  "id"            TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "templateId"    TEXT        NOT NULL,
  "audienceType"  TEXT        NOT NULL,
  "audienceValue" TEXT        NOT NULL,
  "audienceCount" INTEGER     NOT NULL DEFAULT 0,
  "status"        TEXT        NOT NULL DEFAULT 'draft',
  "scheduledAt"   TIMESTAMP(3),
  "sentCount"     INTEGER     NOT NULL DEFAULT 0,
  "failedCount"   INTEGER     NOT NULL DEFAULT 0,
  "sentAt"        TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailBlast_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailBlast_status_idx" ON "EmailBlast"("status");
CREATE INDEX "EmailBlast_scheduledAt_idx" ON "EmailBlast"("scheduledAt");
CREATE INDEX "EmailBlast_createdAt_idx" ON "EmailBlast"("createdAt");

ALTER TABLE "EmailBlast" ADD CONSTRAINT "EmailBlast_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: EmailSent — add blastId (attribution to a specific disparo)
ALTER TABLE "EmailSent" ADD COLUMN "blastId" TEXT;

CREATE INDEX "EmailSent_blastId_idx" ON "EmailSent"("blastId");

ALTER TABLE "EmailSent" ADD CONSTRAINT "EmailSent_blastId_fkey"
  FOREIGN KEY ("blastId") REFERENCES "EmailBlast"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
