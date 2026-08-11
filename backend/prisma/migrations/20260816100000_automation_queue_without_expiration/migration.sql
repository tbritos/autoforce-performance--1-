ALTER TABLE "AutomationJourney"
  ALTER COLUMN "queueTtlHours" DROP NOT NULL;

COMMENT ON COLUMN "AutomationJourney"."queueTtlHours"
  IS 'Tempo máximo na fila em horas; NULL significa sem prazo de expiração';
