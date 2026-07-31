import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { getInstagramAppSecret } from './instagram-env.service';

interface MetaSignedRequestPayload {
  algorithm?: string;
  user_id?: string | number;
  issued_at?: number;
}

export function parseInstagramDataDeletionSignedRequest(signedRequest: unknown): {
  userId: string;
} {
  if (typeof signedRequest !== 'string' || !signedRequest.trim()) {
    throw new Error('signed_request ausente');
  }

  const [encodedSignature, encodedPayload, extra] = signedRequest.split('.');
  if (!encodedSignature || !encodedPayload || extra !== undefined) {
    throw new Error('signed_request inválido');
  }

  const secret = getInstagramAppSecret();
  if (!secret) throw new Error('Instagram App Secret não configurado');

  const expected = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(encodedSignature, 'base64url');
  } catch {
    throw new Error('assinatura de exclusão inválida');
  }
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    throw new Error('assinatura de exclusão inválida');
  }

  let payload: MetaSignedRequestPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as MetaSignedRequestPayload;
  } catch {
    throw new Error('payload de exclusão inválido');
  }

  if (payload.algorithm?.toUpperCase() !== 'HMAC-SHA256') {
    throw new Error('algoritmo de exclusão inválido');
  }
  const userId = String(payload.user_id ?? '').trim();
  if (!userId) throw new Error('user_id ausente no pedido de exclusão');

  return { userId };
}

function deletionStatusUrl(confirmationCode: string): string {
  const appUrl = (process.env.APP_URL || 'http://localhost:5000').replace(/\/+$/, '');
  return `${appUrl}/api/instagram/data-deletion/status?code=${encodeURIComponent(confirmationCode)}`;
}

export async function deleteInstagramUserData(userId: string): Promise<{
  confirmationCode: string;
  statusUrl: string;
}> {
  const confirmationCode = crypto.randomBytes(18).toString('hex');
  const secret = getInstagramAppSecret();
  if (!secret) throw new Error('Instagram App Secret não configurado');
  const userIdHash = crypto.createHmac('sha256', secret).update(userId).digest('hex');

  await prisma.$transaction(async transaction => {
    // O AutoChat atualmente possui uma única conexão Instagram. Um pedido válido
    // vem do usuário que autorizou essa conta, portanto apagamos integralmente os
    // eventos e mensagens do Instagram e removemos credenciais/dados do perfil.
    const [deletedMessages, deletedEvents] = await Promise.all([
      transaction.instagramMessage.deleteMany(),
      transaction.instagramWebhookEvent.deleteMany(),
    ]);

    await transaction.platformConnection.updateMany({
      where: { platform: 'INSTAGRAM' },
      data: {
        status: 'DISCONNECTED',
        accountId: null,
        accountName: null,
        extraIds: [],
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
        metadata: Prisma.DbNull,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        syncCount: 0,
      },
    });

    await transaction.instagramDataDeletionRequest.create({
      data: {
        confirmationCode,
        userIdHash,
        status: 'completed',
        deletedEventCount: deletedEvents.count,
        deletedMessageCount: deletedMessages.count,
        completedAt: new Date(),
      },
    });
  });

  return { confirmationCode, statusUrl: deletionStatusUrl(confirmationCode) };
}

export async function getInstagramDataDeletionStatus(confirmationCode: string) {
  if (!/^[a-f0-9]{36}$/i.test(confirmationCode)) return null;
  return prisma.instagramDataDeletionRequest.findUnique({
    where: { confirmationCode },
    select: { confirmationCode: true, status: true, requestedAt: true, completedAt: true },
  });
}
