import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('API health endpoints', () => {
  const app = createApp();

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('event-platform-api');
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('sets no-store headers for JSON API endpoints', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.headers['pragma']).toBe('no-cache');
  });

  it.each(['/version', '/api/version'])('GET %s returns the release marker as plain text', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text.trim()).toMatch(/\S+/);
  });

  it('POST /webhooks/resend is routed instead of returning 404', async () => {
    const res = await request(app)
      .post('/webhooks/resend')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ type: 'email.delivered', data: { email_id: 'test-email' } }));

    expect(res.status).not.toBe(404);
  });

  it.each([
    ['GET', '/api/admin/events/event-1/media'],
    ['GET', '/api/admin/events/event-1/media/imports'],
    ['POST', '/api/admin/events/event-1/media/imports'],
    ['GET', '/api/admin/events/event-1/media/albums'],
  ])('%s %s requires auth on early-mounted admin media routes', async (method, path) => {
    const res = method === 'POST'
      ? await request(app).post(path)
      : await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });
});
