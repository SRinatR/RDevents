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

  it('POST /webhooks/resend is routed instead of returning 404', async () => {
    const res = await request(app)
      .post('/webhooks/resend')
      .set('content-type', 'application/json')
      .send(JSON.stringify({ type: 'email.delivered', data: { email_id: 'test-email' } }));

    expect(res.status).not.toBe(404);
  });
});
