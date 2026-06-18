-- AlterTable
ALTER TABLE "AIAgent" ADD COLUMN "fallbackModels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
