CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reason" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadActivity_leadEmail_idx" ON "LeadActivity"("leadEmail");
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt");

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadEmail_fkey" FOREIGN KEY ("leadEmail") REFERENCES "Lead"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
