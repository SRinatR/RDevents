import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Router } from 'express';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import type { User } from '@prisma/client';

vi.mock('../../common/middleware.js', async () => {
  const actual = await vi.importActual('../../common/middleware.js');
  return {
    ...actual,
    requireSuperAdmin: (req: any, _res: any, next: any) => {
      if (!req.user || req.user.role !== 'SUPER_ADMIN') {
        return _res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
      }
      next();
    },
  };
});

const mockFs = {
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  openSync: vi.fn(),
  closeSync: vi.fn(),
  unlinkSync: vi.fn(),
  statSync: vi.fn(),
};

vi.mock('fs', () => mockFs);
vi.mock('path', () => ({
  join: (...args: string[]) => args.join('/'),
}));

const RUNTIME_ADMIN = '/opt/rdevents/runtime/admin';
const RUNTIME_CONTROL = '/opt/rdevents/runtime/control';

describe('System Report Router (Legacy)', () => {
  let app: ReturnType<typeof Router>;
  const mockUser: Partial<User> = {
    id: 'user-123',
    email: 'admin@test.com',
    role: 'SUPER_ADMIN',
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
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
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.openSync.mockReturnValue(999);
      mockFs.closeSync.mockReturnValue(undefined);
      mockFs.writeFileSync.mockReturnValue(undefined);

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
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('system-report-refresh-request.json')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
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

    it('returns 409 when status file shows running/queued state', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('system-report-refresh-request.json')) return false;
        if (path.includes('system-report-status.json')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
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
      const nonAdminUser = { ...mockUser, role: 'USER' as any };
      
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
      mockFs.existsSync.mockReturnValue(false);
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 60000 });

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/status');

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('idle');
      expect(res.body.reportExists).toBe(false);
      expect(res.body.downloadAvailable).toBe(false);
    });

    it('returns queued state when request file exists', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('system-report-refresh-request.json')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        requestId: 'req-123',
        requestedAt: '2024-01-01T00:00:00Z',
        requestedByUserId: 'user-123',
        requestedByEmail: 'admin@test.com',
      }));
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 1000 });

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/status');

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('queued');
      expect(res.body.requestId).toBe('req-123');
      expect(res.body.reportExists).toBe(false);
      expect(res.body.downloadAvailable).toBe(false);
    });

    it('returns running state from status file', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('system-report-refresh-request.json')) return true;
        if (path.includes('system-report-status.json')) return true;
        return false;
      });
      mockFs.readFileSync.mockImplementation((path: string) => {
        if (path.includes('system-report-refresh-request.json')) {
          return JSON.stringify({
            requestId: 'req-123',
            requestedAt: '2024-01-01T00:00:00Z',
            requestedByUserId: 'user-123',
            requestedByEmail: 'admin@test.com',
          });
        }
        if (path.includes('system-report-status.json')) {
          return JSON.stringify({
            state: 'running',
            startedAt: new Date().toISOString(),
          });
        }
        return '{}';
      });
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 1000 });

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/status');

      expect(res.status).toBe(200);
      expect(res.body.state).toBe('running');
    });

    it('returns downloadAvailable true when report and meta exist', async () => {
      mockFs.existsSync.mockImplementation((path: string) => {
        if (path.includes('system-report.txt')) return true;
        if (path.includes('system-report-meta.json')) return true;
        return false;
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        fileName: 'system-report.txt',
        generatedAt: '2024-01-01T00:00:00Z',
        fileSizeBytes: 12345,
        sha256: 'abc123',
      }));
      mockFs.statSync.mockReturnValue({ mtimeMs: Date.now() - 60000 });

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/status');

      expect(res.status).toBe(200);
      expect(res.body.reportExists).toBe(true);
      expect(res.body.downloadAvailable).toBe(true);
    });
  });

  describe('GET /download', () => {
    it('returns 404 when report file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/download');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('REPORT_NOT_FOUND');
    });

    it('returns 200 with correct headers when report exists', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({ size: 12345 });
      mockFs.readFileSync.mockReturnValue('Test report content');

      const testApp = await createTestApp();
      const res = await request(testApp).get('/api/admin/system-report/download');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('system-report.txt');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-length']).toBe('12345');
    });

    it('returns 403 for non-SUPER_ADMIN users', async () => {
      const nonAdminUser = { ...mockUser, role: 'USER' as any };
      
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
