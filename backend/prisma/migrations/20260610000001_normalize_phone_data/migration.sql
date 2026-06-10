-- Normalizes existing phone numbers in the Lead table to plain E.164-ish digits.
-- Step 1: strip all non-digit characters (removes spaces, dashes, parentheses, +)
UPDATE "Lead"
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL
  AND phone <> ''
  AND phone ~ '[^0-9]';

-- Step 2: prepend Brazilian country code 55 when missing
UPDATE "Lead"
SET phone = '55' || phone
WHERE phone IS NOT NULL
  AND phone <> ''
  AND phone NOT LIKE '55%'
  AND LENGTH(phone) >= 8;
