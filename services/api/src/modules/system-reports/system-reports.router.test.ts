import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const serviceMocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  getTemplates: vi.fn(),
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  createRun: vi.fn(),
  getRun: vi.fn(),
  getRuns: vi.fn(),
  cancelRun: vi.fn(),
  retryRun: vi.fn(),
  getArtifact: vi.fn(),
  generatePreview: vi.fn(),
  validateAndNormalizeConfig: vi.fn((config) => config),
}));

vi.mock('../../common/middleware.js', () => ({
  requireSuperAdmin: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'admin-1', email: 'admin@example.com', role: 'SUPER_ADMIN' };
    next();
  },
}));

vi.mock('./system-reports.service.js', () => serviceMocks);

const { systemReportsRouter } = await import('./system-reports.router.js');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/system-reports', systemReportsRouter);
  return app;
}

describe('systemReportsRouter', () => {
  const app = createTestApp();

  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.validateAndNormalizeConfig.mockImplementation((config) => config);
  });

  it('GET /api/admin/system-reports/config returns report config', async () => {
    serviceMocks.getConfig.mockResolvedValue({
      sections: [],
      formats: [{ value: 'zip', label: 'ZIP Bundle' }],
      redactionLevels: [],
      limits: { maxArtifacts: 10, maxArtifactSize: 1024, maxReportSize: 2048 },
    });

    const res = await request(app).get('/api/admin/system-reports/config');

    expect(res.status).toBe(200);
    expect(res.body.formats[0].value).toBe('zip');
    expect(serviceMocks.getConfig).toHaveBeenCalledTimes(1);
  });

  it('POST /api/admin/system-reports/preview validates config and returns preview', async () => {
    serviceMocks.generatePreview.mockResolvedValue({
      sections: [{ key: 'health', label: 'Health', description: 'Status', included: true }],
      estimatedSize: 'small',
      warnings: [],
    });

    const body = {
      format: 'zip',
      sections: [{ key: 'health', enabled: true, options: {} }],
      redactionLevel: 'standard',
    };

    const res = await request(app).post('/api/admin/system-reports/preview').send(body);

    expect(res.status).toBe(200);
    expect(res.body.sections[0].key).toBe('health');
    expect(serviceMocks.validateAndNormalizeConfig).toHaveBeenCalledWith(body);
    expect(serviceMocks.generatePreview).toHaveBeenCalledWith(body);
  });

  it('POST /api/admin/system-reports/runs creates a queued run', async () => {
    serviceMocks.createRun.mockResolvedValue({
      id: 'run-1',
      status: 'queued',
      progressPercent: 0,
      artifacts: [],
      events: [],
    });

    const body = {
      title: 'Ops bundle',
      format: 'zip',
      sections: [{ key: 'health', enabled: true, options: {} }],
      redactionLevel: 'standard',
    };

    const res = await request(app).post('/api/admin/system-reports/runs').send(body);

    expect(res.status).toBe(202);
    expect(res.body.id).toBe('run-1');
    expect(serviceMocks.createRun).toHaveBeenCalledWith('admin-1', 'admin@example.com', expect.objectContaining({
      title: 'Ops bundle',
      format: 'zip',
    }));
  });

  it('GET /api/admin/system-reports/runs returns run history', async () => {
    serviceMocks.getRuns.mockResolvedValue([{ id: 'run-1', status: 'success' }]);

    const res = await request(app).get('/api/admin/system-reports/runs?status=success');

    expect(res.status).toBe(200);
    expect(res.body[0].id).toBe('run-1');
    expect(serviceMocks.getRuns).toHaveBeenCalledWith('admin-1', { status: ['success'] });
  });

  it('GET /api/admin/system-reports/runs/:runId returns one run', async () => {
    serviceMocks.getRun.mockResolvedValue({ id: 'run-1', status: 'success' });

    const res = await request(app).get('/api/admin/system-reports/runs/run-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('run-1');
    expect(serviceMocks.getRun).toHaveBeenCalledWith('run-1', 'admin-1');
  });

  it('POST /api/admin/system-reports/runs/:runId/cancel cancels a run', async () => {
    serviceMocks.cancelRun.mockResolvedValue(undefined);

    const res = await request(app).post('/api/admin/system-reports/runs/run-1/cancel');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(serviceMocks.cancelRun).toHaveBeenCalledWith('run-1', 'admin-1');
  });

  it('POST /api/admin/system-reports/runs/:runId/retry creates a retry run', async () => {
    serviceMocks.retryRun.mockResolvedValue({ id: 'run-2', status: 'queued' });

    const res = await request(app).post('/api/admin/system-reports/runs/run-1/retry');

    expect(res.status).toBe(202);
    expect(res.body.id).toBe('run-2');
    expect(serviceMocks.retryRun).toHaveBeenCalledWith('run-1', 'admin-1', 'admin@example.com');
  });

  it('GET /api/admin/system-reports/runs/:runId/artifacts/:artifactId/download downloads an artifact', async () => {
    const content = Buffer.from('zip-content');
    serviceMocks.getArtifact.mockResolvedValue({
      content,
      artifact: {
        id: 'artifact-1',
        fileName: 'report.zip',
        mimeType: 'application/zip',
        sizeBytes: content.length,
      },
    });

    const res = await request(app).get('/api/admin/system-reports/runs/run-1/artifacts/artifact-1/download');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('report.zip');
    expect(Number(res.headers['content-length'])).toBe(content.length);
    expect(res.headers['x-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
    expect(serviceMocks.getArtifact).toHaveBeenCalledWith('run-1', 'artifact-1');
  });
});
