-- Remove somente as cinco duplicidades de receita confirmadas manualmente.
-- A migracao nao consulta nem sincroniza o Pipedrive. Os registros removidos
-- ficam preservados em RevenueEntryDuplicateBackup para recuperacao.

BEGIN;

CREATE TABLE IF NOT EXISTS "RevenueEntryDuplicateBackup" AS
SELECT
  revenue.*,
  CAST(NULL AS TEXT) AS "canonicalId",
  CAST(NULL AS TEXT) AS "removalReason",
  CAST(NULL AS TIMESTAMP(3)) AS "removedAt"
FROM "RevenueEntry" revenue
WHERE FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS "RevenueEntryDuplicateBackup_id_key"
  ON "RevenueEntryDuplicateBackup" ("id");

CREATE TEMPORARY TABLE "_ConfirmedRevenueDuplicate" (
  "canonicalId" TEXT PRIMARY KEY,
  "namePattern" TEXT NOT NULL,
  "mrrValue" DOUBLE PRECISION NOT NULL,
  "setupValue" DOUBLE PRECISION NOT NULL,
  "dateFrom" DATE NOT NULL,
  "dateTo" DATE NOT NULL,
  "removalReason" TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO "_ConfirmedRevenueDuplicate" (
  "canonicalId", "namePattern", "mrrValue", "setupValue", "dateFrom", "dateTo", "removalReason"
)
VALUES
  ('pipedrive-4609', '%davanti%',      997.0, 1496.0, DATE '2026-05-11', DATE '2026-05-11', 'Duplicado confirmado de Davanti Multimarcas; manter negócio Pipedrive 4609'),
  ('pipedrive-2423', '%rovema%',      7396.0, 3894.0, DATE '2026-02-27', DATE '2026-03-02', 'Duplicado confirmado de Rovema; manter negócio Pipedrive 2423'),
  ('pipedrive-3455', '%cana%',        2332.8, 3096.0, DATE '2026-01-30', DATE '2026-01-30', 'Duplicado confirmado de Canaã Motos; manter negócio Pipedrive 3455'),
  ('pipedrive-3191', '%autoshopping%',3585.5, 5687.0, DATE '2025-12-26', DATE '2025-12-26', 'Duplicado confirmado de AutoShopping Goiânia; manter negócio Pipedrive 3191'),
  ('pipedrive-2582', '%simcauto%',    4000.0, 5246.0, DATE '2025-12-23', DATE '2025-12-23', 'Duplicado confirmado de Simcauto; manter negócio Pipedrive 2582');

-- Em desenvolvimento não existem esses negócios e a migração deve ser um
-- no-op. Em produção, se apenas parte dos cinco canônicos ou dos cinco extras
-- for encontrada, aborta tudo para evitar uma exclusão parcial ou ambígua.
DO $$
DECLARE
  canonical_count INTEGER;
  duplicate_count INTEGER;
  matched_groups INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO canonical_count
  FROM "RevenueEntry" revenue
  WHERE revenue."id" IN (SELECT target."canonicalId" FROM "_ConfirmedRevenueDuplicate" target);

  SELECT COUNT(*), COUNT(DISTINCT target."canonicalId")
  INTO duplicate_count, matched_groups
  FROM "RevenueEntry" revenue
  JOIN "_ConfirmedRevenueDuplicate" target
    ON LOWER(revenue."businessName") LIKE target."namePattern"
   AND ABS(revenue."mrrValue" - target."mrrValue") < 0.01
   AND ABS(revenue."setupValue" - target."setupValue") < 0.01
   AND revenue."date" BETWEEN target."dateFrom" AND target."dateTo"
   AND revenue."id" <> target."canonicalId";

  IF canonical_count <> 0 AND canonical_count <> 5 THEN
    RAISE EXCEPTION 'Auditoria de ganhos abortada: esperados 5 registros canônicos, encontrados %', canonical_count;
  END IF;

  IF canonical_count = 5 AND (duplicate_count <> 5 OR matched_groups <> 5) THEN
    RAISE EXCEPTION 'Auditoria de ganhos abortada: esperados 5 duplicados em 5 grupos, encontrados % registros em % grupos', duplicate_count, matched_groups;
  END IF;
END $$;

INSERT INTO "RevenueEntryDuplicateBackup"
SELECT
  revenue.*,
  target."canonicalId",
  target."removalReason",
  CURRENT_TIMESTAMP
FROM "RevenueEntry" revenue
JOIN "_ConfirmedRevenueDuplicate" target
  ON LOWER(revenue."businessName") LIKE target."namePattern"
 AND ABS(revenue."mrrValue" - target."mrrValue") < 0.01
 AND ABS(revenue."setupValue" - target."setupValue") < 0.01
 AND revenue."date" BETWEEN target."dateFrom" AND target."dateTo"
 AND revenue."id" <> target."canonicalId"
WHERE EXISTS (
  SELECT 1
  FROM "RevenueEntry" canonical
  WHERE canonical."id" = target."canonicalId"
)
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "RevenueEntry" revenue
USING "_ConfirmedRevenueDuplicate" target
WHERE LOWER(revenue."businessName") LIKE target."namePattern"
  AND ABS(revenue."mrrValue" - target."mrrValue") < 0.01
  AND ABS(revenue."setupValue" - target."setupValue") < 0.01
  AND revenue."date" BETWEEN target."dateFrom" AND target."dateTo"
  AND revenue."id" <> target."canonicalId"
  AND EXISTS (
    SELECT 1
    FROM "RevenueEntryDuplicateBackup" backup
    WHERE backup."id" = revenue."id"
      AND backup."canonicalId" = target."canonicalId"
  );

DO $$
DECLARE
  canonical_count INTEGER;
  remaining_count INTEGER;
  backup_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO canonical_count
  FROM "RevenueEntry" revenue
  WHERE revenue."id" IN (SELECT target."canonicalId" FROM "_ConfirmedRevenueDuplicate" target);

  IF canonical_count = 0 THEN
    RETURN;
  END IF;

  SELECT COUNT(*)
  INTO remaining_count
  FROM "RevenueEntry" revenue
  JOIN "_ConfirmedRevenueDuplicate" target
    ON LOWER(revenue."businessName") LIKE target."namePattern"
   AND ABS(revenue."mrrValue" - target."mrrValue") < 0.01
   AND ABS(revenue."setupValue" - target."setupValue") < 0.01
   AND revenue."date" BETWEEN target."dateFrom" AND target."dateTo"
   AND revenue."id" <> target."canonicalId";

  SELECT COUNT(*)
  INTO backup_count
  FROM "RevenueEntryDuplicateBackup" backup
  WHERE backup."canonicalId" IN (SELECT target."canonicalId" FROM "_ConfirmedRevenueDuplicate" target);

  IF remaining_count <> 0 OR backup_count <> 5 THEN
    RAISE EXCEPTION 'Remoção de duplicados abortada: restantes %, backups %', remaining_count, backup_count;
  END IF;
END $$;

COMMIT;
