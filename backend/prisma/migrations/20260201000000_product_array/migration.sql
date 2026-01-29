-- AlterTable
ALTER TABLE "RevenueEntry"
ALTER COLUMN "product" TYPE TEXT[]
USING ARRAY["product"];
