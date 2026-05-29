-- Remove FK constraint from UTMLink.createdBy → User.email
-- createdBy is now a plain text field (email or name of who created the link)
ALTER TABLE "UTMLink" DROP CONSTRAINT IF EXISTS "UTMLink_createdBy_fkey";
