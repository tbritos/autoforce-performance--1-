-- CreateTable: EmailTemplate

CREATE TABLE "EmailTemplate" (
  "id"        TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "subject"   TEXT        NOT NULL,
  "body"      TEXT        NOT NULL,
  "fromName"  TEXT,
  "fromEmail" TEXT,
  "isActive"  BOOLEAN     NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailTemplate_isActive_idx" ON "EmailTemplate"("isActive");
CREATE INDEX "EmailTemplate_createdAt_idx" ON "EmailTemplate"("createdAt");

-- AlterTable: EmailSent — add templateId
ALTER TABLE "EmailSent" ADD COLUMN "templateId" TEXT;

CREATE INDEX "EmailSent_templateId_idx" ON "EmailSent"("templateId");

ALTER TABLE "EmailSent" ADD CONSTRAINT "EmailSent_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
