import { randomUUID } from 'crypto';
import { Router } from 'express';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { requireSuperAdmin } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';

const RUNTIME_ADMIN = '/opt/rdevents/runtime/admin';
const RUNTIME_CONTROL = '/opt/rdevents/runtime/control';

const STATUS_FILE = 'system-report-status.json';
const META_FILE = 'system-report-meta.json';
const REPORT_FILE = 'system-report.txt';
const REQUEST_FILE = 'system-report-refresh-request.json';

const REQUEST_TTL_MS = 5 * 60 * 1000;
const STATUS_RUNNING_TTL_MS = 10 * 60 * 1000;

type ReportState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

interface RequestData {
  requestId: string;
  requestedAt: string;
  requestedByUserId: string;
  requestedByEmail: string;
}

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
  requestedByUserId?: string | null;
  requestedByEmail?: string | null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function safeReadJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function readStatus(): StatusData | null {
  return safeReadJson<StatusData>(join(RUNTIME_ADMIN, STATUS_FILE));
}

function readMeta(): MetaData | null {
  return safeReadJson<MetaData>(join(RUNTIME_ADMIN, META_FILE));
}

function readRequest(requestPath: string): RequestData | null {
  return safeReadJson<RequestData>(requestPath);
}

function isRequestStale(requestPath: string): boolean {
  try {
    const stat = statSync(requestPath);
    return Date.now() - stat.mtimeMs > REQUEST_TTL_MS;
  } catch {
    return false;
  }
}

function isStatusStale(status: StatusData): boolean {
  if (status.state !== 'queued' && status.state !== 'running') return false;

  const timestamp = status.startedAt ?? status.requestedAt;
  if (!timestamp) return false;

  const time = new Date(timestamp).getTime();
  if (Number.isNaN(time)) return true;

  return Date.now() - time > STATUS_RUNNING_TTL_MS;
}

function cleanupStaleRequest(requestPath: string): void {
  if (!existsSync(requestPath)) return;
  if (!isRequestStale(requestPath)) return;

  try {
    unlinkSync(requestPath);
  } catch {
    // best-effort cleanup
  }
}

function ensureRuntimeDirs(): void {
  mkdirSync(RUNTIME_CONTROL, { recursive: true });
  mkdirSync(RUNTIME_ADMIN, { recursive: true });
}

export const systemReportRouter = Router();

systemReportRouter.use(requireSuperAdmin);

systemReportRouter.post('/refresh', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  ensureRuntimeDirs();

  const user = (req as AuthenticatedRequest).user!;
  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);

  cleanupStaleRequest(requestPath);

  if (existsSync(requestPath)) {
    const requestData = readRequest(requestPath);

    res.status(409).json({
      error: 'Report generation already in progress',
      code: 'REPORT_GENERATION_IN_PROGRESS',
      state: 'queued',
      requestId: requestData?.requestId ?? null,
    });
    return;
  }

  const currentStatus = readStatus();

  if (
    currentStatus
    && (currentStatus.state === 'queued' || currentStatus.state === 'running')
    && !isStatusStale(currentStatus)
  ) {
    res.status(409).json({
      error: 'Report generation already in progress',
      code: 'REPORT_GENERATION_IN_PROGRESS',
      state: currentStatus.state,
      requestId: currentStatus.requestId,
    });
    return;
  }

  const requestId = randomUUID();
  const requestedAt = new Date().toISOString();

  const requestPayload: RequestData = {
    requestId,
    requestedAt,
    requestedByUserId: user.id,
    requestedByEmail: user.email,
  };

  let fd: number | null = null;

  try {
    fd = openSync(requestPath, 'wx');
    writeFileSync(fd, JSON.stringify(requestPayload, null, 2), 'utf-8');
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      const existingRequest = readRequest(requestPath);

      res.status(409).json({
        error: 'Report generation already in progress',
        code: 'REPORT_GENERATION_IN_PROGRESS',
        state: 'queued',
        requestId: existingRequest?.requestId ?? null,
      });
      return;
    }

    throw error;
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }

  res.status(202).json({
    ok: true,
    requestId,
    state: 'queued',
    requestedAt,
    requestedBy: user.email,
  });
});

systemReportRouter.get('/status', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);
  const reportPath = join(RUNTIME_ADMIN, REPORT_FILE);

  cleanupStaleRequest(requestPath);

  const status = readStatus();
  const meta = readMeta();
  const reportExists = existsSync(reportPath);
  const downloadAvailable = reportExists && meta !== null;
  const requestData = existsSync(requestPath) ? readRequest(requestPath) : null;

  if (requestData) {
    res.json({
      state: status?.state === 'running' ? 'running' : 'queued',
      requestId: requestData.requestId,
      requestedAt: requestData.requestedAt,
      requestedByUserId: requestData.requestedByUserId,
      requestedByEmail: requestData.requestedByEmail,
      startedAt: status?.startedAt ?? null,
      finishedAt: status?.finishedAt ?? null,
      lastSuccessAt: status?.lastSuccessAt ?? null,
      lastError: status?.lastError ?? null,
      fileName: meta?.fileName ?? null,
      generatedAt: meta?.generatedAt ?? null,
      fileSizeBytes: meta?.fileSizeBytes ?? null,
      sha256: meta?.sha256 ?? null,
      reportExists,
      downloadAvailable,
    });
    return;
  }

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
      reportExists,
      downloadAvailable,
    });
    return;
  }

  const staleStatus = isStatusStale(status);

  res.json({
    state: staleStatus ? (status.state === 'running' ? 'failed' : 'idle') : status.state,
    requestId: status.requestId,
    requestedAt: status.requestedAt,
    requestedByUserId: status.requestedByUserId,
    requestedByEmail: status.requestedByEmail,
    startedAt: status.startedAt,
    finishedAt: status.finishedAt,
    lastSuccessAt: status.lastSuccessAt,
    lastError: staleStatus ? 'Previous report generation timed out/stale' : status.lastError,
    fileName: meta?.fileName ?? null,
    generatedAt: meta?.generatedAt ?? null,
    fileSizeBytes: meta?.fileSizeBytes ?? null,
    sha256: meta?.sha256 ?? null,
    reportExists,
    downloadAvailable,
  });
});

systemReportRouter.get('/download', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  const reportPath = join(RUNTIME_ADMIN, REPORT_FILE);

  if (!existsSync(reportPath)) {
    res.status(404).json({
      error: 'Report file not found',
      code: 'REPORT_NOT_FOUND',
    });
    return;
  }

  const stat = statSync(reportPath);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="system-report.txt"');
  res.setHeader('Content-Length', stat.size);

  res.send(readFileSync(reportPath));
});
