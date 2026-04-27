import { describe, expect, it } from 'vitest';
import { createUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token.service.js';

describe('unsubscribe-token.service', () => {
  it('creates a valid token with required fields', () => {
    const token = createUnsubscribeToken({
      email: 'test@example.com',
    });

    expect(token).toBeTruthy();
    expect(token.split('.').length).toBe(2);
  });

  it('creates token with all optional fields', () => {
    const token = createUnsubscribeToken({
      email: 'user@test.com',
      userId: 'user-123',
      broadcastId: 'broadcast-456',
      topic: 'MARKETING',
    });

    const payload = verifyUnsubscribeToken(token);

    expect(payload.email).toBe('user@test.com');
    expect(payload.userId).toBe('user-123');
    expect(payload.broadcastId).toBe('broadcast-456');
    expect(payload.topic).toBe('MARKETING');
  });

  it('normalizes email to lowercase', () => {
    const token = createUnsubscribeToken({
      email: 'TEST@EXAMPLE.COM',
    });

    const payload = verifyUnsubscribeToken(token);
    expect(payload.email).toBe('test@example.com');
  });

  it('normalizes email by trimming whitespace', () => {
    const token = createUnsubscribeToken({
      email: '  user@example.com  ',
    });

    const payload = verifyUnsubscribeToken(token);
    expect(payload.email).toBe('user@example.com');
  });

  it('rejects invalid token format', () => {
    expect(() => verifyUnsubscribeToken('not-a-valid-token')).toThrow('INVALID_UNSUBSCRIBE_TOKEN');
  });

  it('rejects token with missing signature', () => {
    expect(() => verifyUnsubscribeToken('somepayload')).toThrow('INVALID_UNSUBSCRIBE_TOKEN');
  });

  it('rejects tampered token', () => {
    const token = createUnsubscribeToken({ email: 'test@example.com' });
    const [payload, _sig] = token.split('.');
    const tampered = `${payload}.invalid_signature_here`;

    expect(() => verifyUnsubscribeToken(tampered)).toThrow('INVALID_UNSUBSCRIBE_TOKEN');
  });

  it('throws for expired token', () => {
    const token = createUnsubscribeToken({
      email: 'test@example.com',
      ttlSeconds: -1,
    });

    expect(() => verifyUnsubscribeToken(token)).toThrow('EXPIRED_UNSUBSCRIBE_TOKEN');
  });

  it('uses default topic when not provided', () => {
    const token = createUnsubscribeToken({ email: 'test@example.com' });
    const payload = verifyUnsubscribeToken(token);

    expect(payload.topic).toBe('MARKETING');
  });
});
