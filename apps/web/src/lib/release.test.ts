import { describe, expect, it, vi } from 'vitest';

describe('getWebReleaseSha', () => {
  it('uses NEXT_PUBLIC_RELEASE_SHA first', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', 'sha-from-next-public');
    vi.stubEnv('RELEASE_SHA', 'sha-from-release');

    const mod = await import('./release');
    expect(mod.getWebReleaseSha()).toBe('sha-from-next-public');
  });

  it('falls back to RELEASE_SHA when NEXT_PUBLIC_RELEASE_SHA is missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', '');
    vi.stubEnv('RELEASE_SHA', 'sha-from-release');

    const mod = await import('./release');
    expect(mod.getWebReleaseSha()).toBe('sha-from-release');
  });

  it('returns local when both env vars are empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', '');
    vi.stubEnv('RELEASE_SHA', '');

    const mod = await import('./release');
    expect(mod.getWebReleaseSha()).toBe('local');
  });
});

describe('getWebReleasePayload', () => {
  it('returns correct structure', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', 'test-sha');
    vi.stubEnv('NODE_ENV', 'production');

    const mod = await import('./release');
    const payload = mod.getWebReleasePayload();

    expect(payload).toEqual({
      service: 'event-platform-web',
      releaseSha: 'test-sha',
      environment: 'production',
    });
  });

  it('uses NODE_ENV value when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', 'test-sha');
    vi.stubEnv('NODE_ENV', 'test');

    const mod = await import('./release');
    const payload = mod.getWebReleasePayload();

    expect(payload.environment).toBe('test');
  });
});