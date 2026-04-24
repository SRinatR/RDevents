import { Router } from 'express';
import { requireSuperAdmin } from '../../common/middleware.js';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const RUNTIME_ADMIN = '/opt/rdevents/runtime/admin';
const LEGACY_STATUS_FILE = 'system-report-status.json';
const LEGACY_META_FILE = 'system-report-meta.json';
const LEGACY_REPORT_FILE = 'system-report.txt';

export const systemReportRouter = Router();

systemReportRouter.use(requireSuperAdmin);

systemReportRouter.get('/status', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const reportPath = join(RUNTIME_ADMIN, LEGACY_REPORT_FILE);
  const statusPath = join(RUNTIME_ADMIN, LEGACY_STATUS_FILE);
  const metaPath = join(RUNTIME_ADMIN, LEGACY_META_FILE);

  const reportExists = existsSync(reportPath);
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf-8')) : null;
  const status = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf-8')) : null;

  res.json({
    state: status?.state ?? 'idle',
    requestId: status?.requestId ?? null,
    requestedAt: status?.requestedAt ?? null,
    requestedByUserId: status?.requestedByUserId ?? null,
    requestedByEmail: status?.requestedByEmail ?? null,
    startedAt: status?.startedAt ?? null,
    finishedAt: status?.finishedAt ?? null,
    lastSuccessAt: status?.lastSuccessAt ?? null,
    lastError: status?.lastError ?? null,
    fileName: meta?.fileName ?? null,
    generatedAt: meta?.generatedAt ?? null,
    fileSizeBytes: meta?.fileSizeBytes ?? null,
    sha256: meta?.sha256 ?? null,
    reportExists,
    downloadAvailable: reportExists && meta !== null,
  });
});

systemReportRouter.get('/download', async (_req, res) => {
  const reportPath = join(RUNTIME_ADMIN, LEGACY_REPORT_FILE);

  if (!existsSync(reportPath)) {
    res.status(404).json({ error: 'Report file not found', code: 'REPORT_NOT_FOUND' });
    return;
  }

  const stat = statSync(reportPath);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="system-report.txt"');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', stat.size);

  res.send(readFileSync(reportPath));
});
