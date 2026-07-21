-- Move filtros/período de por-widget para o nível do relatório (filtro
-- global + período global, decisão do usuário — um relatório não suporta
-- mais filtro/período por widget). Feature tem poucos dias de vida com pouco
-- uso real ainda, então aceitamos descartar os dados antigos de
-- filters/dateFrom/dateTo/datePreset por widget em vez de tentar uma junção
-- (com perda) entre widgets que podem ter configs conflitantes.

ALTER TABLE "Report" ADD COLUMN "filters" JSONB;
ALTER TABLE "Report" ADD COLUMN "dateFrom" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "dateTo" TIMESTAMP(3);
ALTER TABLE "Report" ADD COLUMN "datePreset" TEXT;

ALTER TABLE "ReportWidget" DROP COLUMN "filters";
ALTER TABLE "ReportWidget" DROP COLUMN "dateFrom";
ALTER TABLE "ReportWidget" DROP COLUMN "dateTo";
ALTER TABLE "ReportWidget" DROP COLUMN "datePreset";
