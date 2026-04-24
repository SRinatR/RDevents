import { Router } from 'express';
import { requireSuperAdmin } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import { readFileSync, existsSync, statSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from 'fs';
import { join } from 'path';
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getGenerationHistory,
  getGenerationStatus,
  startGeneration,
  downloadReport,
  getAvailableSections,
  getLegacyStatus,
  downloadLegacyReport,
  initializeDefaultTemplates,
} from '../system-report/system-report.service.js';

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
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      const existingRequestData = readRequest(requestPath);
      res.status(409).json({
        error: 'Report generation already in progress',
        code: 'REPORT_GENERATION_IN_PROGRESS',
        state: 'queued',
        requestId: existingRequestData?.requestId ?? null,
      });
      return;
    }
    throw err;
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
  res.setHeader('Cache-Control', 'no-store');

  const requestPath = join(RUNTIME_CONTROL, REQUEST_FILE);
  const reportPath = join(RUNTIME_ADMIN, REPORT_FILE);
  const status = readStatus();
  const meta = readMeta();
  const reportExists = existsSync(reportPath);
  const downloadAvailable = reportExists && meta !== null;

  const requestData = existsSync(requestPath) ? readRequest(requestPath) : null;
  const requestStale = requestData ? isRequestStale(requestPath) : false;

  if (requestStale) {
    try {
      unlinkSync(requestPath);
    } catch {
      // ignore cleanup errors
    }
  }

  if (requestData && !requestStale) {
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
    reportExists,
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

systemReportRouter.get('/v2/templates', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    await initializeDefaultTemplates(user.id);
    const templates = await getTemplates(user.id);
    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

systemReportRouter.post('/v2/templates', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { name, description, config, isDefault } = req.body;

    if (!name || !config) {
      res.status(400).json({ error: 'Name and config are required' });
      return;
    }

    const template = await createTemplate(user.id, { name, description, config, isDefault });
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

systemReportRouter.put('/v2/templates/:templateId', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { templateId } = req.params;
    const { name, description, config, isDefault } = req.body;

    const template = await updateTemplate(user.id, templateId, { name, description, config, isDefault });
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    if (error instanceof Error && error.message === 'Template not found') {
      res.status(404).json({ error: 'Template not found' });
    } else {
      res.status(500).json({ error: 'Failed to update template' });
    }
  }
});

systemReportRouter.delete('/v2/templates/:templateId', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { templateId } = req.params;

    await deleteTemplate(user.id, templateId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting template:', error);
    if (error instanceof Error && error.message === 'Template not found') {
      res.status(404).json({ error: 'Template not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete template' });
    }
  }
});

systemReportRouter.get('/v2/sections', async (_req, res) => {
  try {
    const sections = await getAvailableSections();
    res.json(sections);
  } catch (error) {
    console.error('Error getting sections:', error);
    res.status(500).json({ error: 'Failed to get sections' });
  }
});

systemReportRouter.get('/v2/generations', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const limit = parseInt(req.query.limit as string) || 20;
    const generations = await getGenerationHistory(user.id, limit);
    res.json(generations);
  } catch (error) {
    console.error('Error getting generation history:', error);
    res.status(500).json({ error: 'Failed to get generation history' });
  }
});

systemReportRouter.get('/v2/generations/:generationId', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { generationId } = req.params;

    const generation = await getGenerationStatus(generationId, user.id);
    res.json(generation);
  } catch (error) {
    console.error('Error getting generation status:', error);
    if (error instanceof Error && error.message === 'Generation not found') {
      res.status(404).json({ error: 'Generation not found' });
    } else {
      res.status(500).json({ error: 'Failed to get generation status' });
    }
  }
});

systemReportRouter.post('/v2/generations', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { config, templateId } = req.body;

    if (!config) {
      res.status(400).json({ error: 'Config is required' });
      return;
    }

    const generation = await startGeneration(user.id, user.email, config, templateId);
    res.status(202).json(generation);
  } catch (error) {
    console.error('Error starting generation:', error);
    if (error instanceof Error && error.message === 'Generation already in progress') {
      res.status(409).json({ error: 'Generation already in progress', code: 'GENERATION_IN_PROGRESS' });
    } else {
      res.status(500).json({ error: 'Failed to start generation' });
    }
  }
});

systemReportRouter.get('/v2/generations/:generationId/download', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { generationId } = req.params;

    const report = await downloadReport(generationId, user.id);

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', report.fileSize);
    res.setHeader('X-Content-SHA256', report.sha256);

    res.send(report.content);
  } catch (error) {
    console.error('Error downloading report:', error);
    if (error instanceof Error && error.message === 'Generation not found') {
      res.status(404).json({ error: 'Generation not found' });
    } else if (error instanceof Error && error.message === 'Report not ready') {
      res.status(400).json({ error: 'Report not ready', code: 'REPORT_NOT_READY' });
    } else if (error instanceof Error && error.message === 'Report file not found') {
      res.status(404).json({ error: 'Report file not found', code: 'REPORT_FILE_NOT_FOUND' });
    } else {
      res.status(500).json({ error: 'Failed to download report' });
    }
  }
});

systemReportRouter.get('/v2/legacy-status', async (_req, res) => {
  try {
    const status = await getLegacyStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting legacy status:', error);
    res.status(500).json({ error: 'Failed to get legacy status' });
  }
});

systemReportRouter.get('/v2/legacy-download', async (_req, res) => {
  try {
    const report = await downloadLegacyReport();

    res.setHeader('Content-Type', report.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Length', report.fileSize);
    res.setHeader('X-Content-SHA256', report.sha256);

    res.send(report.content);
  } catch (error) {
    console.error('Error downloading legacy report:', error);
    if (error instanceof Error && error.message === 'Report file not found') {
      res.status(404).json({ error: 'Report file not found', code: 'REPORT_NOT_FOUND' });
    } else {
      res.status(500).json({ error: 'Failed to download report' });
    }
  }
});
