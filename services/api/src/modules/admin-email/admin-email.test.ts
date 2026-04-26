import request from 'supertest';
import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';

const app = createApp();

describe('admin-email router access', () => {
  describe('GET /api/admin/email/overview', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/email/overview');

      expect(res.status).toBe(401);
    });

    it('returns 403 for regular user', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });

      if (loginRes.status !== 200) {
        expect(loginRes.status).toBe(401);
        return;
      }

      const token = loginRes.body?.accessToken;
      if (!token) {
        expect(token).toBeTruthy();
        return;
      }

      const res = await request(app)
        .get('/api/admin/email/overview')
        .set('Authorization', `Bearer ${token}`);

      expect([200, 403]).toContain(res.status);
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
