import { describe, expect, it, vi } from 'vitest';

describe('GET /release.json route', () => {
  it('returns correct service name', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', 'test-sha');
    vi.stubEnv('NODE_ENV', 'production');

    const mod = await import('@/lib/release');
    const payload = mod.getWebReleasePayload();

    expect(payload.service).toBe('event-platform-web');
  });

  it('returns releaseSha', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', 'test-sha');
    vi.stubEnv('NODE_ENV', 'production');

    const mod = await import('@/lib/release');
    const payload = mod.getWebReleasePayload();

    expect(payload).toHaveProperty('releaseSha');
    expect(typeof payload.releaseSha).toBe('string');
    expect(payload.releaseSha.length).toBeGreaterThan(0);
  });

  it('payload structure matches expected JSON contract', async () => {
    vi.stubEnv('NEXT_PUBLIC_RELEASE_SHA', 'abc123');
    vi.stubEnv('NODE_ENV', 'development');

    const mod = await import('@/lib/release');
    const payload = mod.getWebReleasePayload();

    const jsonString = JSON.stringify(payload);
    const parsed = JSON.parse(jsonString);

    expect(parsed).toHaveProperty('service', 'event-platform-web');
    expect(parsed).toHaveProperty('releaseSha');
    expect(parsed).toHaveProperty('environment');
  });
});