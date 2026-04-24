import { Router } from 'express';
import { requireSuperAdmin } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import { readFileSync, existsSync, statSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from 'fs';
import { join } from 'path';

const RUNTIME_ADMIN = '/opt/rdevents/runtime/admin';
const RUNTIME_CONTROL = '/opt/rdevents/runtime/control';
const STATUS_FILE = 'system-report-status.json';
const META_FILE = 'system-report-meta.json';
const REPORT_FILE = 'system-report.txt';
const REQUEST_FILE = 'system-report-refresh-request.json';

export type ReportState = 'idle' | 'queued' | 'running' | 'success' | 'failed';

export interface RequestData {
  requestId: string;
  requestedAt: string;
  requestedByUserId: string;
  requestedByEmail: string;
}

export interface StatusData {
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

const REQUEST_TTL_MS = 5 * 60 * 1000;
const STATUS_RUNNING_TTL_MS = 10 * 60 * 1000;

function isRequestStale(requestPath: string): boolean {
  try {
    const stat = statSync(requestPath);
    const ageMs = Date.now() - stat.mtimeMs;
    return ageMs > REQUEST_TTL_MS;
  } catch {
    return false;
  }
}

function isStatusStale(status: StatusData): boolean {
  if (status.state !== 'queued' && status.state !== 'running') return false;
  const timestamp = status.startedAt ?? status.requestedAt;
  if (!timestamp) return false;
  const ageMs = Date.now() - new Date(timestamp).getTime();
  return ageMs > STATUS_RUNNING_TTL_MS;
}

function readRequest(requestPath: string): RequestData | null {
  try {
    return JSON.parse(readFileSync(requestPath, 'utf-8')) as RequestData;
  } catch {
    return null;
  }
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

function atomicWriteFile(filePath: string, content: string): void {
  const tempPath = `${filePath}.tmp.${process.pid}`;
  writeFileSync(tempPath, content, 'utf-8');
  renameSync(tempPath, filePath);
}

export const systemReportRouter = Router();

systemReportRouter.use(requireSuperAdmin);

systemReportRouter.post('/refresh', async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);

  if (existsSync(requestPath)) {
    if (isRequestStale(requestPath)) {
      try {
        unlinkSync(requestPath);
      } catch {
        // ignore unlink errors
      }
    } else {
      const requestData = readRequest(requestPath);

      res.status(409).json({
        error: 'Report generation already in progress',
        state: 'queued',
        requestId: requestData?.requestId ?? null,
      });
      return;
    }
  }

  const currentStatus = readStatus();
  if (currentStatus && (currentStatus.state === 'queued' || currentStatus.state === 'running')) {
    if (isStatusStale(currentStatus)) {
      // Stale status detected - allow new request and clean up
    } else {
      res.status(409).json({
        error: 'Report generation already in progress',
        state: currentStatus.state,
        requestId: currentStatus.requestId,
      });
      return;
    }
  }

  const requestId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();

  const requestPayload = {
    requestId,
    requestedAt,
    requestedByUserId: user.id,
    requestedByEmail: user.email,
  };

  let fd: number | null = null;
  try {
    fd = openSync(requestPath, 'wx');
    writeFileSync(fd, JSON.stringify(requestPayload, null, 2), 'utf-8');
  } finally {
    if (fd !== null) closeSync(fd);
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
  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);
  const reportPath = join(RUNTIME_ADMIN, REPORT_FILE);
  const status = readStatus();
  const meta = readMeta();
  const reportExists = existsSync(reportPath);
  const downloadAvailable = reportExists && meta !== null;

  const requestData = existsSync(requestPath) ? readRequest(requestPath) : null;
  const requestStale = requestData ? isRequestStale(requestPath) : false;

  if (requestData && !requestStale && status && (status.state === 'queued' || status.state === 'running')) {
    res.json({
      state: 'queued',
      requestId: requestData.requestId,
      requestedAt: requestData.requestedAt,
      requestedByUserId: requestData.requestedByUserId,
      requestedByEmail: requestData.requestedByEmail,
      startedAt: status.startedAt,
      finishedAt: status.finishedAt,
      lastSuccessAt: status.lastSuccessAt,
      lastError: status.lastError,
      fileName: meta?.fileName ?? null,
      generatedAt: meta?.generatedAt ?? null,
      fileSizeBytes: meta?.fileSizeBytes ?? null,
      sha256: meta?.sha256 ?? null,
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
      downloadAvailable,
    });
    return;
  }

  let effectiveState = status.state;
  let effectiveLastError = status.lastError;

  if (isStatusStale(status)) {
    effectiveState = status.state === 'running' ? 'failed' : 'idle';
    effectiveLastError = 'Previous report generation timed out/stale';
  }

  res.json({
    state: effectiveState,
    requestId: status.requestId,
    requestedAt: status.requestedAt,
    requestedByUserId: status.requestedByUserId,
    requestedByEmail: status.requestedByEmail,
    startedAt: status.startedAt,
    finishedAt: status.finishedAt,
    lastSuccessAt: status.lastSuccessAt,
    lastError: effectiveLastError,
    fileName: meta?.fileName ?? null,
    generatedAt: meta?.generatedAt ?? null,
    fileSizeBytes: meta?.fileSizeBytes ?? null,
    sha256: meta?.sha256 ?? null,
    downloadAvailable,
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

  res.send(readFileSync(reportPath));
});
