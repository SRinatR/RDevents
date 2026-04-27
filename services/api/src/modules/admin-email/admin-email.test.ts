import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';

const app = createApp();

describe('admin-email router access', () => {
  describe('GET /api/admin/email/overview', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/email/overview');

      expect(res.status).toBe(401);
    });
  });
});

describe('POST /api/email/unsubscribe', () => {
  it('returns 400 without token', async () => {
    const res = await request(app)
      .post('/api/email/unsubscribe')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOKEN_REQUIRED');
  });

  it('returns 400 for invalid token', async () => {
    const res = await request(app)
      .post('/api/email/unsubscribe')
      .send({ token: 'invalid-token' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_UNSUBSCRIBE_TOKEN');
  });
});
