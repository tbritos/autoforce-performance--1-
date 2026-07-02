// Heuristica para pegar bots genericos de spam de formulario, que preenchem
// todos os campos de texto com strings aleatorias (ex: name="WaALlYwxEyCDWGkVSSjKCsEg",
// company="mqKhRymCFxXfxMDxUuevyWtB", email="9219381938@vtext.com").
// Conservadora por design: exige dois sinais independentes concordando antes de
// marcar como bot, para nao desqualificar leads reais por engano.

const SMS_GATEWAY_DOMAINS = new Set([
  'vtext.com', 'txt.att.net', 'tmomail.net', 'messaging.sprintpcs.com',
  'vmobl.com', 'myboostmobile.com', 'mymetropcs.com', 'sms.mycricket.com',
]);

function looksLikeRandomGibberish(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 10 || /\s/.test(trimmed)) return false;
  if (!/^[A-Za-z]+$/.test(trimmed)) return false;
  if (!/[a-z]/.test(trimmed) || !/[A-Z]/.test(trimmed)) return false;

  const vowels = (trimmed.match(/[aeiouAEIOU]/g) || []).length;
  return vowels / trimmed.length < 0.2;
}

function hasSuspiciousSmsGatewayEmail(email: string): boolean {
  const [localPart, domain] = email.trim().toLowerCase().split('@');
  if (!localPart || !domain) return false;
  return SMS_GATEWAY_DOMAINS.has(domain) && /^\d{8,}$/.test(localPart);
}

export function isLikelyBotLead(fields: { name?: string | null; company?: string | null; email?: string | null }): boolean {
  const textFields = [fields.name, fields.company].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const gibberishFields = textFields.filter(looksLikeRandomGibberish);
  if (gibberishFields.length >= 2) return true;

  if (fields.email && hasSuspiciousSmsGatewayEmail(fields.email)) return true;

  return false;
}
