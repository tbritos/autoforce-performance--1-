/**
 * Normalizes a phone number to E.164-ish format for Brazil (55 + digits).
 * Strips all non-digit characters, then prepends "55" if not already present.
 */
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('55') && digits.length >= 11) return digits;
  if (digits.length >= 8) return `55${digits}`;
  return digits;
}

/**
 * Returns all searchable variants of a phone number for DB lookup.
 *
 * Handles:
 * - With/without 55 country code
 * - Multiple suffix lengths (8–11 digits) for `contains` matching
 * - Brazil 8↔9 digit mobile migration (DDD + 8 or 9 local digits)
 *
 * Example: "558496805226" (12 digits, 8-digit local) generates the
 * 9-digit variant "5584996805226" and vice-versa, so a DB record stored
 * in either format is found.
 */
export function phoneSearchVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return [];

  const full = digits.startsWith('55') ? digits : `55${digits}`;
  const noCC = full.slice(2); // without country code

  const set = new Set<string>();
  set.add(full);
  set.add(noCC);

  // Suffix variants (8–11 chars) — cover formatted DB phones after normalization
  for (let len = 8; len <= 11; len++) {
    if (full.length >= len) set.add(full.slice(-len));
    if (noCC.length >= len) set.add(noCC.slice(-len));
  }

  // Brazil 8↔9 digit migration: DDD(2) + local(8 or 9)
  if (noCC.length === 10) {
    // 8-digit local → also try 9-digit (prepend 9 to local)
    const ddd = noCC.slice(0, 2);
    const local9 = `9${noCC.slice(2)}`;
    const alt = `${ddd}${local9}`;
    set.add(alt);
    set.add(`55${alt}`);
    set.add(local9);
    set.add(noCC.slice(2)); // 8-digit local alone
  } else if (noCC.length === 11) {
    // 9-digit local → also try 8-digit (strip leading 9)
    const ddd = noCC.slice(0, 2);
    const local9 = noCC.slice(2);
    if (local9.startsWith('9')) {
      const local8 = local9.slice(1);
      const alt = `${ddd}${local8}`;
      set.add(alt);
      set.add(`55${alt}`);
      set.add(local8);
      set.add(local9);
    }
  }

  return Array.from(set).filter(v => v.length >= 8);
}
