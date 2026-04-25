import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Router } from 'express';

const mockFsExistsSync = vi.fn();
const mockFsMkdirSync = vi.fn();
const mockFsReadFileSync = vi.fn();
const mockFsWriteFileSync = vi.fn();
const mockFsOpenSync = vi.fn();
const mockFsCloseSync = vi.fn();
const mockFsUnlinkSync = vi.fn();
const mockFsStatSync = vi.fn();
const mockPathJoin = vi.fn((...args: string[]) => args.join('/'));

vi.mock('fs', () => ({
  existsSync: mockFsExistsSync,
  mkdirSync: mockFsMkdirSync,
  readFileSync: mockFsReadFileSync,
  writeFileSync: mockFsWriteFileSync,
  openSync: mockFsOpenSync,
  closeSync: mockFsCloseSync,
  unlinkSync: mockFsUnlinkSync,
  statSync: mockFsStatSync,
}));

vi.mock('path', () => ({
  join: mockPathJoin,
}));

vi.mock('../../common/middleware.js', () => ({
  requireSuperAdmin: (_req: any, res: any, next: any) => {
    if (!_req.user || _req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    }
    next();
  },
}));

vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_ACCESS_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  },
}));

describe('System Report Router (Legacy)', () => {
  const mockUser = {
    id: 'user-123',
    email: 'admin@test.com',
    role: 'SUPER_ADMIN',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFsExistsSync.mockReturnValue(false);
    mockFsMkdirSync.mockReturnValue(undefined);
    mockFsOpenSync.mockReturnValue(999);
    mockFsCloseSync.mockReturnValue(undefined);
    mockFsWriteFileSync.mockReturnValue(undefined);
    mockFsStatSync.mockReturnValue({ mtimeMs: Date.now() - 60000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createTestApp() {
    const { systemReportRouter } = await import('./system-report.router.js');
    const express = await import('express');
    const testApp = express.default();
    testApp.use((req: any, _res: any, next: any) => {
      req.user = mockUser;
      next();
    });
    testApp.use('/api/admin/system-report', systemReportRouter);
    return testApp;
  }

  describe('POST /refresh', () => {
    it('returns 202 and creates request file for SUPER_ADMIN', async () => {
      const testApp = await createTestApp();
      const res = await request(testApp).post('/api/admin/system-report/refresh');

      expect(res.status).toBe(202);
      expect(res.body.ok).toBe(true);
      expect(res.body.state).toBe('queued');
      expect(res.body.requestId).toBeDefined();
      expect(res.body.requestedAt).toBeDefined();
      expect(res.body.requestedBy).toBe('admin@test.com');
    });

    it('returns 409 when request file already exists', async () => {
      mockFsExistsSync.mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('system-report-refresh-request.json')) {
          return true;
        }
        return false;
      });
      mockFsReadFileSync.mockReturnValue(JSON.stringify({
        requestId: 'existing-id',
        requestedAt: '2024-01-01T00:00:00Z',
        requestedByUserId: 'other-user',
        requestedByEmail: 'other@test.com',
      }));

      const testApp = await createTestApp();
      const res = await request(testApp).post('/api/admin/system-report/refresh');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('REPORT_GENERATION_IN_PROGRESS');
      expect(res.body.state).toBe('queued');
    });

    it('returns 409 when status file shows running state', async () => {
      mockFsExistsSync.mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('system-report-refresh-request.json')) {
          return false;
        }
        if (typeof path === 'string' && path.includes('system-report-status.json')) {
          return true;
        }
        return false;
      });
      mockFsReadFileSync.mockReturnValue(JSON.stringify({
        state: 'running',
        requestId: 'running-id',
        requestedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      }));

      const testApp = await createTestApp();
      const res = await request(testApp).post('/api/admin/system-report/refresh');

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('REPORT_GENERATION_IN_PROGRESS');
    });

    it('returns 403 for non-SUPER_ADMIN users', async () => {
      const nonAdminUser = { ...mockUser, role: 'USER' };

      const { systemReportRouter } = await import('./system-report.router.js');
      const express = await import('express');
      const testApp = express.default();
      testApp.use((req: any, _res: any, next: any) => {
        req.user = nonAdminUser;
        next();
      });
      testApp.use('/api/admin/system-report', systemReportRouter);

      const res = await request(testApp).post('/api/admin/system-report/refresh');

      expect(res.status).toBe(403);
    });
  });

  describe('GET /status', () => {
    it('returns idle state when no files exist', async () => {
      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/status');

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('idle');
      expect(res.body.reportExists).toBe(false);
      expect(res.body.downloadAvailable).toBe(false);
    });

    it('returns queued state when request file exists', async () => {
      mockFsExistsSync.mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('system-report-refresh-request.json')) {
          return true;
        }
        return false;
      });
      mockFsReadFileSync.mockReturnValue(JSON.stringify({
        requestId: 'req-123',
        requestedAt: '2024-01-01T00:00:00Z',
        requestedByUserId: 'user-123',
        requestedByEmail: 'admin@test.com',
      }));

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/status');

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('queued');
      expect(res.body.requestId).toBe('req-123');
      expect(res.body.reportExists).toBe(false);
      expect(res.body.downloadAvailable).toBe(false);
    });

    it('returns downloadAvailable true when report and meta exist', async () => {
      mockFsExistsSync.mockImplementation((path: string) => {
        if (typeof path === 'string' && path.includes('system-report.txt')) {
          return true;
        }
        if (typeof path === 'string' && path.includes('system-report-meta.json')) {
          return true;
        }
        return false;
      });
      mockFsReadFileSync.mockReturnValue(JSON.stringify({
        fileName: 'system-report.txt',
        generatedAt: '2024-01-01T00:00:00Z',
        fileSizeBytes: 12345,
        sha256: 'abc123',
      }));

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/status');

      expect(res.status).toBe(200);
      expect(res.body.reportExists).toBe(true);
      expect(res.body.downloadAvailable).toBe(true);
    });
  });

  describe('GET /download', () => {
    it('returns 404 when report file does not exist', async () => {
      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/download');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('REPORT_NOT_FOUND');
    });

    it('returns 200 with correct headers when report exists', async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsStatSync.mockReturnValue({ size: 12345 });
      mockFsReadFileSync.mockReturnValue('Test report content');

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/download');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('system-report.txt');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-length']).toBe(String(Buffer.byteLength('Test report content', 'utf-8')));
    });

    it('returns 403 for non-SUPER_ADMIN users', async () => {
      const nonAdminUser = { ...mockUser, role: 'USER' };

      const { systemReportRouter } = await import('./system-report.router.js');
      const express = await import('express');
      const testApp = express.default();
      testApp.use((req: any, _res: any, next: any) => {
        req.user = nonAdminUser;
        next();
      });
      testApp.use('/api/admin/system-report', systemReportRouter);

      const res = await request(testApp).get('/api/admin/system-report/download');

      expect(res.status).toBe(403);
    });
  });
});
