import { Router } from 'express';
import { requirePlatformAdmin } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import { readFileSync, existsSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

const RUNTIME_ADMIN = '/opt/rdevents/runtime/admin';
const RUNTIME_CONTROL = '/opt/rdevents/runtime/control';
const STATUS_FILE = 'system-report-status.json';
const META_FILE = 'system-report-meta.json';
const REPORT_FILE = 'system-report.txt';
const REQUEST_FILE = 'system-report-refresh-request.json';

type ReportState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

interface StatusData {
  state: ReportState;
  requestId: string | null;
  requestedAt: string | null;
  requestedByUserId: string | null;
  requestedByEmail: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

interface MetaData {
  fileName: string;
  generatedAt: string;
  fileSizeBytes: number;
  sha256: string;
  requestedByUserId: string | null;
  requestedByEmail: string | null;
}

function readStatus(): StatusData | null {
  const path = join(RUNTIME_ADMIN, STATUS_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function readMeta(): MetaData | null {
  const path = join(RUNTIME_ADMIN, META_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function writeStatus(status: StatusData): void {
  const path = join(RUNTIME_ADMIN, STATUS_FILE);
  writeFileSync(path, JSON.stringify(status, null, 2), 'utf-8');
}

export const systemReportRouter = Router();

systemReportRouter.use(requirePlatformAdmin);

systemReportRouter.post('/refresh', async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;

  const currentStatus = readStatus();
  if (currentStatus && (currentStatus.state === 'queued' || currentStatus.state === 'running')) {
    res.status(409).json({
      error: 'Report generation already in progress',
      state: currentStatus.state,
      requestId: currentStatus.requestId,
    });
    return;
  }

  const requestId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  const queuedStatus: StatusData = {
    state: 'queued',
    requestId,
    requestedAt,
    requestedByUserId: user.id,
    requestedByEmail: user.email,
    startedAt: null,
    finishedAt: null,
    lastSuccessAt: currentStatus?.lastSuccessAt ?? null,
    lastError: null,
  };

  writeStatus(queuedStatus);

  const requestPayload = {
    requestId,
    requestedAt,
    requestedByUserId: user.id,
    requestedByEmail: user.email,
  };

  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);
  writeFileSync(requestPath, JSON.stringify(requestPayload, null, 2), 'utf-8');

  res.status(202).json({
    ok: true,
    requestId,
    state: 'queued',
    requestedAt,
    requestedBy: user.email,
  });
});

systemReportRouter.get('/status', async (_req, res) => {
  const status = readStatus();
  const meta = readMeta();

  if (!status) {
    res.json({
      state: 'idle',
      requestId: null,
      requestedAt: null,
      requestedByUserId: null,
      requestedByEmail: null,
      startedAt: null,
      finishedAt: null,
      lastSuccessAt: null,
      lastError: null,
      fileName: null,
      generatedAt: null,
      fileSizeBytes: null,
      sha256: null,
    });
    return;
  }

  res.json({
    state: status.state,
    requestId: status.requestId,
    requestedAt: status.requestedAt,
    requestedByUserId: status.requestedByUserId,
    requestedByEmail: status.requestedByEmail,
    startedAt: status.startedAt,
    finishedAt: status.finishedAt,
    lastSuccessAt: status.lastSuccessAt,
    lastError: status.lastError,
    fileName: meta?.fileName ?? null,
    generatedAt: meta?.generatedAt ?? null,
    fileSizeBytes: meta?.fileSizeBytes ?? null,
    sha256: meta?.sha256 ?? null,
  });
});

systemReportRouter.get('/download', async (_req, res) => {
  const reportPath = join(RUNTIME_ADMIN, REPORT_FILE);

  if (!existsSync(reportPath)) {
    res.status(404).json({ error: 'Report file not found', code: 'REPORT_NOT_FOUND' });
    return;
  }

  const stat = statSync(reportPath);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="system-report.txt"');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', stat.size);

  const stream = readFileSync(reportPath);
  res.send(stream);
});