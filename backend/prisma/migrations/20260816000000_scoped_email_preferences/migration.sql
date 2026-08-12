-- A desinscrição passa a valer por categoria de comunicação. Denúncias de
-- spam continuam globais para proteger a reputação do domínio remetente.
ALTER TABLE "EmailSuppression"
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'newsletter';

UPDATE "EmailSuppression"
SET "scope" = 'all'
WHERE "reason" = 'complaint';

DROP INDEX IF EXISTS "EmailSuppression_email_key";

CREATE UNIQUE INDEX "EmailSuppression_email_scope_key"
  ON "EmailSuppression"("email", "scope");
CREATE INDEX "EmailSuppression_email_idx"
  ON "EmailSuppression"("email");
CREATE INDEX "EmailSuppression_scope_idx"
  ON "EmailSuppression"("scope");

ALTER TABLE "EmailBlast"
  ADD COLUMN "communicationType" TEXT NOT NULL DEFAULT 'MARKETING';
