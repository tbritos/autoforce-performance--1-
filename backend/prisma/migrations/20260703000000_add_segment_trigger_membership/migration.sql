-- CreateTable: SegmentTriggerMembership — rastreia quem satisfaz as regras de um
-- segmento usado como gatilho de automacao ("Entrou em segmento")

CREATE TABLE "SegmentTriggerMembership" (
  "id"        TEXT        NOT NULL,
  "segmentId" TEXT        NOT NULL,
  "leadEmail" TEXT        NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SegmentTriggerMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SegmentTriggerMembership_segmentId_leadEmail_key"
  ON "SegmentTriggerMembership"("segmentId", "leadEmail");

CREATE INDEX "SegmentTriggerMembership_segmentId_idx" ON "SegmentTriggerMembership"("segmentId");
CREATE INDEX "SegmentTriggerMembership_leadEmail_idx" ON "SegmentTriggerMembership"("leadEmail");

ALTER TABLE "SegmentTriggerMembership" ADD CONSTRAINT "SegmentTriggerMembership_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "Segment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
