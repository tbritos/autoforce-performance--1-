-- Additive: stores the Pipedrive lost_reason when a lead's status changes to LOST
ALTER TABLE "LeadStatusHistory" ADD COLUMN "lostReason" TEXT;
