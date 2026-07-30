-- Keep the Instagram messaging connection separate from Meta Ads.
-- This prevents ad permissions and Instagram inbox permissions from sharing tokens.
ALTER TYPE "Platform" ADD VALUE 'INSTAGRAM';
