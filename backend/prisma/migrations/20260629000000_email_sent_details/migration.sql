ALTER TABLE "EmailSent"
  ADD COLUMN "htmlBody" TEXT,
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "clickedUrl" TEXT;
