-- "Um gráfico só por relatório": colapsa a config por-widget (N linhas em
-- ReportWidget + posições de react-grid-layout) em 3 colunas direto no
-- Report. Só aditivo — as linhas de ReportWidget e o Report.layout ficam
-- como estão, o código de aplicação só para de ler/escrever neles.
--
-- Diferente da 20260721000000_report_global_filters (que apagou filtros/
-- datas por-widget que já eram puras duplicatas dos campos globais recém
-- criados), relatórios com mais de 1 widget hoje têm configuração
-- genuinamente distinta e não-redundante nas linhas 2..N de ReportWidget. O
-- backfill só consegue levar a config de UM widget adiante, então apagar a
-- tabela agora destruiria os outros widgets sem chance de recuperação.
-- Fica assim (aditivo) até confirmar que ninguém precisa recuperar esses
-- widgets extras — aí sim uma migração de limpeza apaga ReportWidget e
-- Report.layout.

ALTER TABLE "Report" ADD COLUMN "metricKey" TEXT;
ALTER TABLE "Report" ADD COLUMN "groupBy" TEXT;
ALTER TABLE "Report" ADD COLUMN "chartType" "ReportWidgetType" NOT NULL DEFAULT 'BAR_CHART';

-- Backfill: cada relatório herda métrica/agrupamento/tipo do seu widget de
-- menor sortOrder (o que aparecia no canto superior esquerdo do grid antigo).
UPDATE "Report" r
SET "metricKey" = w."metricKey",
    "groupBy"   = w."groupBy",
    "chartType" = w."type"
FROM (
  SELECT DISTINCT ON ("reportId") "reportId", "metricKey", "groupBy", "type"
  FROM "ReportWidget"
  ORDER BY "reportId", "sortOrder" ASC
) w
WHERE r."id" = w."reportId";
