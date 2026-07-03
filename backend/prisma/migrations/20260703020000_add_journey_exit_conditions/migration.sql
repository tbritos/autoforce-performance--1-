-- AlterTable: AutomationJourney — condicao de saida global do fluxo
ALTER TABLE "AutomationJourney" ADD COLUMN "exitConditions" JSONB;
