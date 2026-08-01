const BRAZIL_COUNTRY_CODE = '55';

function isValidE164Digits(value: string): boolean {
  return /^[1-9]\d{7,14}$/.test(value);
}

function stripBrazilDialingPrefix(digits: string): string {
  // Prefixo internacional discado do Brasil: 00 + codigo do pais.
  if (digits.startsWith('00')) return digits.slice(2);

  // Ligacao nacional com operadora: 0 + XX (operadora) + DDD + numero.
  if (digits.startsWith('0') && (digits.length === 13 || digits.length === 14)) {
    return digits.slice(3);
  }

  // Zero de longa distancia sem codigo de operadora: 0 + DDD + numero.
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    return digits.slice(1);
  }

  return digits;
}

function normalizeBrazilNationalNumber(national: string): string | null {
  if (national.length !== 10 && national.length !== 11) return null;

  const ddd = national.slice(0, 2);
  let local = national.slice(2);
  if (!/^[1-9]\d$/.test(ddd)) return null;

  if (local.length === 8) {
    // Antes da migracao para o nono digito, celulares brasileiros podiam
    // comecar por 6, 7, 8 ou 9. Telefones fixos (2 a 5) continuam com 8
    // digitos e nao devem receber um 9 artificial.
    if (/^[6-9]/.test(local)) local = `9${local}`;
    else if (!/^[2-5]/.test(local)) return null;
  } else if (!/^9\d{8}$/.test(local)) {
    return null;
  }

  return `${BRAZIL_COUNTRY_CODE}${ddd}${local}`;
}

/**
 * Normaliza telefone para o formato aceito pela API do WhatsApp (somente
 * digitos, com codigo do pais).
 *
 * Para numeros brasileiros, corrige automaticamente:
 * - ausencia do codigo 55;
 * - zero/prefixo de operadora antes do DDD;
 * - celular antigo com 8 digitos, inserindo o nono digito;
 * - DDD 55, sem confundi-lo com o codigo do pais.
 *
 * Numeros internacionais informados com "+" ou "00" sao preservados. Sem
 * DDD nao existe informacao suficiente para inventar um numero valido, entao
 * a funcao retorna null.
 */
export function normalizePhoneE164(phone: string | null | undefined): string | null {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;

  const hadExplicitInternationalPrefix = raw.startsWith('+') || /^00/.test(raw.replace(/[^\d]/g, ''));
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  digits = stripBrazilDialingPrefix(digits);
  if (!digits) return null;

  if (hadExplicitInternationalPrefix && !digits.startsWith(BRAZIL_COUNTRY_CODE)) {
    return isValidE164Digits(digits) ? digits : null;
  }

  // Com 12/13 digitos iniciados por 55, o codigo do pais ja veio informado.
  if (digits.startsWith(BRAZIL_COUNTRY_CODE) && (digits.length === 12 || digits.length === 13)) {
    return normalizeBrazilNationalNumber(digits.slice(2));
  }

  // Com 10/11 digitos, trata como DDD + numero. Isso tambem resolve o DDD
  // 55: "55 99999-9999" recebe outro 55 como codigo do Brasil.
  if (digits.length === 10 || digits.length === 11) {
    const brazilian = normalizeBrazilNationalNumber(digits);
    if (brazilian) return brazilian;

    // Um numero internacional sem "+" pode ter 11 digitos. So o preserva
    // quando ele claramente nao se encaixa nas regras brasileiras.
    if (digits.length === 11 && !digits.startsWith(BRAZIL_COUNTRY_CODE) && isValidE164Digits(digits)) {
      return digits;
    }
    return null;
  }

  // Um E.164 longo sem "+" que nao comeca por 55 tambem e preservado.
  if (
    digits.length >= 12
    && !digits.startsWith(BRAZIL_COUNTRY_CODE)
    && isValidE164Digits(digits)
  ) {
    return digits;
  }

  return null;
}

/**
 * Retorna variantes para localizar no banco o mesmo telefone salvo antes ou
 * depois da normalizacao (com/sem 55 e com/sem o nono digito brasileiro).
 */
export function phoneSearchVariants(phone: string): string[] {
  const rawDigits = phone.replace(/\D/g, '');
  if (!rawDigits) return [];

  const normalized = normalizePhoneE164(phone);
  const full = normalized ?? rawDigits;
  const set = new Set<string>([full, rawDigits]);

  const isBrazilian = full.startsWith(BRAZIL_COUNTRY_CODE)
    && (full.length === 12 || full.length === 13);

  if (!isBrazilian) {
    return Array.from(set).filter(v => v.length >= 8);
  }

  const noCC = full.slice(2);
  set.add(noCC);

  // Sufixos ajudam a encontrar registros antigos ainda formatados ou sem DDD.
  for (let len = 8; len <= 11; len++) {
    if (full.length >= len) set.add(full.slice(-len));
    if (noCC.length >= len) set.add(noCC.slice(-len));
  }

  // Inclui a forma antiga sem o nono digito para reconciliar registros
  // historicos. A normalizacao de novos valores sempre grava a forma atual.
  if (noCC.length === 11) {
    const ddd = noCC.slice(0, 2);
    const local = noCC.slice(2);
    if (local.startsWith('9')) {
      const legacyLocal = local.slice(1);
      const legacyNational = `${ddd}${legacyLocal}`;
      set.add(legacyLocal);
      set.add(legacyNational);
      set.add(`${BRAZIL_COUNTRY_CODE}${legacyNational}`);
    }
  }

  return Array.from(set).filter(v => v.length >= 8);
}
