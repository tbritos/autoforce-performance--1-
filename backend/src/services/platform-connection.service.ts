import { prisma } from '../config/database';
import { Platform, ConnectionStatus } from '@prisma/client';
import crypto from 'crypto';

// ============================================================
// Token encryption — AES-256-GCM
// Key must be 32 bytes (64 hex chars) in ENCRYPTION_KEY env var.
// ============================================================

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if ((!key || key.length !== 64) && process.env.NODE_ENV === 'development') {
    console.warn('ENCRYPTION_KEY nao configurada. Usando chave local apenas para desenvolvimento.');
    return Buffer.from('0'.repeat(64), 'hex');
  }
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// ============================================================
// PlatformConnectionService
// ============================================================

export interface SaveConnectionInput {
  platform: Platform;
  accountId?: string;
  accountName?: string;
  extraIds?: string[];
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  metadata?: Record<string, any>;
}

export interface UpdateConnectionConfigInput extends SaveConnectionInput {
  status?: ConnectionStatus;
}

// Fields returned in public API responses — tokens are never included
const PUBLIC_SELECT = {
  id: true,
  platform: true,
  status: true,
  accountId: true,
  accountName: true,
  extraIds: true,
  tokenExpiry: true,
  metadata: true,
  lastSyncAt: true,
  lastSyncStatus: true,
  lastSyncError: true,
  syncCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

function sanitizeConnection<T extends { metadata?: any } | null>(connection: T): T {
  if (!connection?.metadata || typeof connection.metadata !== 'object' || Array.isArray(connection.metadata)) {
    return connection;
  }
  const metadata = { ...connection.metadata };
  if (metadata.serviceAccountJson) {
    metadata.serviceAccountJson = true;
  }
  return { ...connection, metadata };
}

export class PlatformConnectionService {

  static async listConnections() {
    const connections = await prisma.platformConnection.findMany({
      orderBy: { platform: 'asc' },
      select: PUBLIC_SELECT,
    });
    return connections.map(connection => sanitizeConnection(connection));
  }

  static async getConnection(platform: Platform) {
    const connection = await prisma.platformConnection.findUnique({
      where: { platform },
      select: PUBLIC_SELECT,
    });
    return sanitizeConnection(connection);
  }

  static async getInternalConnection(platform: Platform) {
    return prisma.platformConnection.findUnique({
      where: { platform },
    });
  }

  // Get decrypted tokens (for internal service use only — never expose in API)
  static async getTokens(platform: Platform): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiry: Date | null;
  } | null> {
    const row = await prisma.platformConnection.findUnique({ where: { platform } });
    if (!row) return null;

    return {
      accessToken: row.accessToken ? decrypt(row.accessToken) : null,
      refreshToken: row.refreshToken ? decrypt(row.refreshToken) : null,
      tokenExpiry: row.tokenExpiry,
    };
  }

  // Save (upsert) connection with encrypted tokens
  static async saveConnection(input: SaveConnectionInput) {
    const encryptedAccess = input.accessToken ? encrypt(input.accessToken) : undefined;
    const encryptedRefresh = input.refreshToken ? encrypt(input.refreshToken) : undefined;

    const updateData = {
      status: 'CONNECTED' as ConnectionStatus,
      lastSyncError: null,
      lastSyncStatus: null,
      ...(encryptedAccess !== undefined ? { accessToken: encryptedAccess } : {}),
      ...(encryptedRefresh !== undefined ? { refreshToken: encryptedRefresh } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId || null } : {}),
      ...(input.accountName !== undefined ? { accountName: input.accountName || null } : {}),
      ...(input.extraIds !== undefined ? { extraIds: input.extraIds } : {}),
      ...(input.tokenExpiry !== undefined ? { tokenExpiry: input.tokenExpiry || null } : {}),
      ...(input.metadata !== undefined ? { metadata: (input.metadata as any) || null } : {}),
    };

    const connection = await prisma.platformConnection.upsert({
      where: { platform: input.platform },
      update: updateData,
      create: {
        platform: input.platform,
        status: 'CONNECTED' as ConnectionStatus,
        accountId: input.accountId || null,
        accountName: input.accountName || null,
        extraIds: input.extraIds || [],
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiry: input.tokenExpiry || null,
        metadata: (input.metadata as any) || null,
      },
      select: {
        id: true,
        platform: true,
        status: true,
        accountId: true,
        accountName: true,
        extraIds: true,
        tokenExpiry: true,
        metadata: true,
        lastSyncAt: true,
        lastSyncStatus: true,
        syncCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return sanitizeConnection(connection);
  }

  static async updateConnectionConfig(input: UpdateConnectionConfigInput) {
    const encryptedAccess = input.accessToken ? encrypt(input.accessToken) : undefined;
    const encryptedRefresh = input.refreshToken ? encrypt(input.refreshToken) : undefined;

    const updateData = {
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(encryptedAccess !== undefined ? { accessToken: encryptedAccess } : {}),
      ...(encryptedRefresh !== undefined ? { refreshToken: encryptedRefresh } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId || null } : {}),
      ...(input.accountName !== undefined ? { accountName: input.accountName || null } : {}),
      ...(input.extraIds !== undefined ? { extraIds: input.extraIds } : {}),
      ...(input.tokenExpiry !== undefined ? { tokenExpiry: input.tokenExpiry || null } : {}),
      ...(input.metadata !== undefined ? { metadata: (input.metadata as any) || null } : {}),
    };

    const connection = await prisma.platformConnection.upsert({
      where: { platform: input.platform },
      update: updateData,
      create: {
        platform: input.platform,
        status: input.status || 'DISCONNECTED',
        accountId: input.accountId || null,
        accountName: input.accountName || null,
        extraIds: input.extraIds || [],
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiry: input.tokenExpiry || null,
        metadata: (input.metadata as any) || null,
      },
      select: PUBLIC_SELECT,
    });
    return sanitizeConnection(connection);
  }

  // Disconnect a platform (clear tokens, set status to DISCONNECTED)
  static async disconnectPlatform(platform: Platform) {
    return prisma.platformConnection.upsert({
      where: { platform },
      update: {
        status: 'DISCONNECTED',
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        lastSyncError: null,
        lastSyncStatus: null,
      },
      create: {
        platform,
        status: 'DISCONNECTED',
        extraIds: [],
      },
      select: {
        id: true,
        platform: true,
        status: true,
        accountId: true,
        accountName: true,
        updatedAt: true,
      },
    });
  }

  // Mark connection as errored (called when an API request fails with auth error)
  static async markError(platform: Platform, error: string) {
    return prisma.platformConnection.upsert({
      where: { platform },
      update: {
        status: 'ERROR',
        lastSyncError: error,
        lastSyncStatus: 'error',
      },
      create: {
        platform,
        status: 'ERROR',
        extraIds: [],
        lastSyncError: error,
        lastSyncStatus: 'error',
      },
    });
  }

  // Update sync stats after a successful sync
  static async recordSyncSuccess(platform: Platform) {
    return prisma.platformConnection.upsert({
      where: { platform },
      update: {
        status: 'CONNECTED',
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        syncCount: { increment: 1 },
      },
      create: {
        platform,
        status: 'CONNECTED',
        extraIds: [],
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        syncCount: 1,
      },
    });
  }
}
