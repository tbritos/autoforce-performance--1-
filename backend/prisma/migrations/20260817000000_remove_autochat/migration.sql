-- Remove a conexão direta do Instagram e os dados exclusivos do AutoChat.
DELETE FROM "PlatformConnection" WHERE "platform" = 'INSTAGRAM';

DROP TABLE IF EXISTS "InstagramMessage";
DROP TABLE IF EXISTS "InstagramWebhookEvent";
DROP TABLE IF EXISTS "InstagramDataDeletionRequest";

-- PostgreSQL não remove valores de enum diretamente. Recriamos o tipo sem
-- INSTAGRAM depois de excluir a única linha que poderia usar esse valor.
ALTER TYPE "Platform" RENAME TO "Platform_old";

CREATE TYPE "Platform" AS ENUM (
  'META_ADS',
  'GOOGLE_ADS',
  'GOOGLE_ANALYTICS',
  'RD_STATION',
  'GOOGLE_CALENDAR',
  'PIPEDRIVE',
  'CLARITY',
  'WHATSAPP'
);

ALTER TABLE "PlatformConnection"
  ALTER COLUMN "platform" TYPE "Platform"
  USING ("platform"::text::"Platform");

DROP TYPE "Platform_old";
