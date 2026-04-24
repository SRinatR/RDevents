import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('release endpoints', () => {
  it('returns api release json', async () => {
    const app = createApp();
    const res = await request(app).get('/release.json');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('event-platform-api');
    expect(res.body.releaseSha).toBeTruthy();
  });

  it('returns api release json under /api/release.json', async () => {
    const app = createApp();
    const res = await request(app).get('/api/release.json');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('event-platform-api');
    expect(res.body.releaseSha).toBeTruthy();
  });
});