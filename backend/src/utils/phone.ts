/**
 * Normalizes a phone number to E.164-ish format for Brazil (55 + digits).
 * Strips all non-digit characters, then prepends "55" if not already present.
 *
 * Examples:
 *   "(84) 99968-0521"  → "5584999680521"
 *   "(55) 84996-8052"  → "55849968052"   (already had 55 prefix)
 *   "5584999680521"    → "5584999680521" (untouched)
 *   "+55 84 9996-8052" → "55849996-8052" → "558499968052"
 */
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  // Already has Brazilian country code with enough digits
  if (digits.startsWith('55') && digits.length >= 11) {
    return digits;
  }

  // Local or DDD+local number — prepend country code
  if (digits.length >= 8) {
    return `55${digits}`;
  }

  // Too short to be a valid phone — store raw digits
  return digits;
}
