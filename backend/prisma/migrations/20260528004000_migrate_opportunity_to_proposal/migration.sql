-- Migrate existing OPPORTUNITY leads to PROPOSAL (OPPORTUNITY is being retired)
UPDATE "Lead" SET status = 'PROPOSAL' WHERE status = 'OPPORTUNITY';
