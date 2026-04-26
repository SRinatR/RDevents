import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';

type UnsubscribePayload = {
  email: string;
  userId?: string | null;
  broadcastId?: string | null;
  topic?: string | null;
  exp: number;
};

function base64url(input: string | Buffer) {
  return Buffer
    .from(input)
    .toString('base64url');
}

function sign(data: string) {
  return createHmac('sha256', env.JWT_REFRESH_SECRET)
    .update(data)
    .digest('base64url');
}

export function createUnsubscribeToken(input: {
  email: string;
  userId?: string | null;
  broadcastId?: string | null;
  topic?: string | null;
  ttlSeconds?: number;
}) {
  const payload: UnsubscribePayload = {
    email: input.email.trim().toLowerCase(),
    userId: input.userId ?? null,
    broadcastId: input.broadcastId ?? null,
    topic: input.topic ?? 'MARKETING',
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? 60 * 60 * 24 * 365),
  };

  const body = base64url(JSON.stringify(payload));
  const signature = sign(body);

  return `${body}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload {
  const [body, signature] = token.split('.');

  if (!body || !signature) {
    throw new Error('INVALID_UNSUBSCRIBE_TOKEN');
  }

  const expected = sign(body);

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error('INVALID_UNSUBSCRIBE_TOKEN');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UnsubscribePayload;

  if (!payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('EXPIRED_UNSUBSCRIBE_TOKEN');
  }

  return payload;
}
