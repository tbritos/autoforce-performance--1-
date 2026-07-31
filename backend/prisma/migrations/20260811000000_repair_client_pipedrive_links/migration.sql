-- A sincronizacao antiga podia substituir o negocio ganho de um cliente por
-- outro negocio aberto da mesma pessoa (por exemplo, um card de onboarding).
-- RevenueEntry e criado exclusivamente a partir de negocio ganho inbound e,
-- portanto, e a fonte de verdade mais segura para restaurar o deal do cliente.
WITH ranked_wins AS (
  SELECT
    re."leadEmail",
    SUBSTRING(re.id FROM LENGTH('pipedrive-') + 1) AS "dealId",
    re.date,
    re."mrrValue",
    re."setupValue",
    ROW_NUMBER() OVER (
      PARTITION BY re."leadEmail"
      ORDER BY re.date DESC, re."updatedAt" DESC
    ) AS position
  FROM "RevenueEntry" re
  WHERE re.id LIKE 'pipedrive-%'
    AND re."leadEmail" IS NOT NULL
), latest_wins AS (
  SELECT *
  FROM ranked_wins
  WHERE position = 1
)
UPDATE "Lead" lead
SET
  "pipedriveDealId" = win."dealId",
  status = 'CLIENT',
  "pipedriveDealStatus" = 'won',
  "pipedriveDealValue" = win."mrrValue",
  "pipedriveSetupValue" = win."setupValue",
  "convertedAt" = COALESCE(lead."convertedAt", win.date),
  "updatedAt" = NOW()
FROM latest_wins win
WHERE lead.email = win."leadEmail"
  AND lead."convertedAt" IS NOT NULL
  AND lead."pipedriveDealStatus" = 'open'
  AND lead."pipedriveDealId" IS DISTINCT FROM win."dealId";
