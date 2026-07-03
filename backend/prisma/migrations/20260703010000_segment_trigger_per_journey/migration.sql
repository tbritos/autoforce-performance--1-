-- SegmentTriggerMembership passa a ser rastreado por journey, nao so por segmento,
-- para que uma automacao nova possa processar quem ja esta no segmento mesmo que
-- outra automacao mais antiga ja tenha "consumido" essa entrada.
--
-- Linhas existentes nao tem journeyId conhecido (o design anterior nao guardava isso)
-- e sao puro estado interno de rastreamento (nao dado de negocio) — limpar aqui e
-- seguro e faz o proximo ciclo do avaliador tratar os membros atuais como entrada
-- nova para as automacoes configuradas.
DELETE FROM "SegmentTriggerMembership";

DROP INDEX IF EXISTS "SegmentTriggerMembership_segmentId_leadEmail_key";

ALTER TABLE "SegmentTriggerMembership" ADD COLUMN "journeyId" TEXT NOT NULL;

CREATE UNIQUE INDEX "SegmentTriggerMembership_segmentId_journeyId_leadEmail_key"
  ON "SegmentTriggerMembership"("segmentId", "journeyId", "leadEmail");

CREATE INDEX "SegmentTriggerMembership_journeyId_idx" ON "SegmentTriggerMembership"("journeyId");
