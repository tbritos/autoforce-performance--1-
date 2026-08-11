import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const TOKEN_VERSION = 1;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export function normalizeUnsubscribeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email inválido');
  }
  return email;
}

function getSecret(): string {
  const secret = process.env.EMAIL_UNSUBSCRIBE_SECRET
    || process.env.AUTH_SESSION_SECRET
    || process.env.JWT_SECRET;
  if (!secret) throw new Error('EMAIL_UNSUBSCRIBE_SECRET ou AUTH_SESSION_SECRET não configurado');
  return secret;
}

function getKey(): Buffer {
  return createHash('sha256').update(`autoforce:email-unsubscribe:${getSecret()}`).digest();
}

// AES-GCM deixa o token autenticado e também impede que o email fique legível na URL.
// O token não expira: links antigos de descadastro precisam continuar funcionando.
export function createUnsubscribeToken(emailValue: string): string {
  const email = normalizeUnsubscribeEmail(emailValue);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const payload = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, email }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

export function readUnsubscribeToken(token: string): string {
  try {
    const data = Buffer.from(token, 'base64url');
    if (data.length <= IV_BYTES + AUTH_TAG_BYTES) throw new Error('Token incompleto');

    const iv = data.subarray(0, IV_BYTES);
    const tag = data.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const encrypted = data.subarray(IV_BYTES + AUTH_TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(tag);
    const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const payload = JSON.parse(decoded) as { v?: number; email?: string };
    if (payload.v !== TOKEN_VERSION || !payload.email) throw new Error('Token incompatível');
    return normalizeUnsubscribeEmail(payload.email);
  } catch {
    throw new Error('Link de desinscrição inválido');
  }
}

function firstCorsOrigin(): string | undefined {
  return process.env.CORS_ORIGIN?.split(',')[0]?.trim() || undefined;
}

export function buildUnsubscribeUrl(email: string): string {
  const frontendUrl = (process.env.FRONTEND_URL || firstCorsOrigin() || 'http://localhost:5173').replace(/\/+$/, '');
  const token = createUnsubscribeToken(email);
  return `${frontendUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function buildOneClickUnsubscribeUrl(email: string): string {
  const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined;
  const apiUrl = (process.env.APP_URL || railwayUrl || 'http://localhost:5000').replace(/\/+$/, '');
  const token = createUnsubscribeToken(email);
  return `${apiUrl}/api/email-unsubscribe/${encodeURIComponent(token)}`;
}

export function maskUnsubscribeEmail(emailValue: string): string {
  const email = normalizeUnsubscribeEmail(emailValue);
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
