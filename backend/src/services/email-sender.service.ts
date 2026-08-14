export class SenderEmailValidationError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = 'SenderEmailValidationError';
  }
}

export function normalizeSenderEmail(value: unknown): string | null {
  const email = String(value ?? '').trim();
  if (!email) return null;

  const atIndex = email.lastIndexOf('@');
  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1).toLowerCase();

  if (
    atIndex <= 0 ||
    email.indexOf('@') !== atIndex ||
    !localPart ||
    !domain ||
    email.length > 254 ||
    /\s/.test(email)
  ) {
    throw new SenderEmailValidationError('Informe um e-mail de remetente válido.');
  }

  return `${localPart}@${domain}`;
}

export function assertSenderDomainAllowed(email: string, allowedDomains: string[]): void {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const normalizedAllowedDomains = new Set(allowedDomains.map(item => item.trim().toLowerCase()));

  if (!normalizedAllowedDomains.has(domain)) {
    throw new SenderEmailValidationError(
      `O domínio ${domain} não está habilitado para envio no Resend.`
    );
  }
}
