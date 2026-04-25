import { Router } from 'express';
import { requireSuperAdmin } from '../../common/middleware.js';
import type { AuthenticatedRequest } from '../../common/middleware.js';
import {
  getConfig,
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  createRun,
  getRun,
  getRuns,
  cancelRun,
  retryRun,
  getArtifact,
  type ReportConfig,
} from './system-reports.service.js';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

export const systemReportsRouter = Router();

systemReportsRouter.use(requireSuperAdmin);

systemReportsRouter.get('/config', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const config = await getConfig();
    res.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: 'Failed to get config' });
  }
});

systemReportsRouter.get('/templates', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = (req as AuthenticatedRequest).user!;
    const templates = await getTemplates(user.id);
    res.json(templates);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

systemReportsRouter.post('/templates', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { name, description, config, isDefault } = req.body;

    if (!name || !config) {
      res.status(400).json({ error: 'Name and config are required' });
      return;
    }

    const template = await createTemplate(user.id, {
      name,
      description,
      config,
      isDefault,
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

systemReportsRouter.patch('/templates/:templateId', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { templateId } = req.params;
    const { name, description, config, isDefault } = req.body;

    const template = await updateTemplate(user.id, templateId, {
      name,
      description,
      config,
      isDefault,
    });

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

systemReportsRouter.delete('/templates/:templateId', async (req, res) => {
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

systemReportsRouter.post('/runs', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');

  try {
    const user = (req as AuthenticatedRequest).user!;
    const { templateId, title, format, sections, redactionLevel } = req.body;

    if (!format || !sections) {
      res.status(400).json({ error: 'Format and sections are required' });
      return;
    }

    if (!['txt', 'json', 'md', 'zip'].includes(format)) {
      res.status(400).json({ error: 'Invalid format' });
      return;
    }

    if (redactionLevel === 'off' && user.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Only super admins can disable redaction' });
      return;
    }

    const run = await createRun(user.id, user.email, {
      templateId,
      title,
      format,
      sections,
      redactionLevel: redactionLevel || 'standard',
    });

    res.status(202).json(run);
  } catch (error) {
    console.error('Error creating run:', error);
    res.status(500).json({ error: 'Failed to create run' });
  }
});

systemReportsRouter.get('/runs', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { status, templateId, dateFrom, dateTo } = req.query;

    const filters: any = {};
    if (status) {
      filters.status = Array.isArray(status) ? status : [status];
    }
    if (templateId) filters.templateId = templateId as string;
    if (dateFrom) filters.dateFrom = dateFrom as string;
    if (dateTo) filters.dateTo = dateTo as string;

    const runs = await getRuns(user.id, filters);
    res.json(runs);
  } catch (error) {
    console.error('Error getting runs:', error);
    res.status(500).json({ error: 'Failed to get runs' });
  }
});

systemReportsRouter.get('/runs/:runId', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { runId } = req.params;

    const run = await getRun(runId, user.id);

    if (!run) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    res.json(run);
  } catch (error) {
    console.error('Error getting run:', error);
    res.status(500).json({ error: 'Failed to get run' });
  }
});

systemReportsRouter.post('/runs/:runId/cancel', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { runId } = req.params;

    await cancelRun(runId, user.id);
    res.json({ ok: true });
  } catch (error) {
    console.error('Error canceling run:', error);
    if (error instanceof Error) {
      if (error.message === 'Run not found') {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      if (error.message.includes('Cannot cancel')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Failed to cancel run' });
  }
});

systemReportsRouter.post('/runs/:runId/retry', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { runId } = req.params;

    const newRun = await retryRun(runId, user.id, user.email);
    res.status(202).json(newRun);
  } catch (error) {
    console.error('Error retrying run:', error);
    if (error instanceof Error) {
      if (error.message === 'Run not found') {
        res.status(404).json({ error: 'Run not found' });
        return;
      }
      if (error.message.includes('Cannot retry')) {
        res.status(400).json({ error: error.message });
        return;
      }
    }
    res.status(500).json({ error: 'Failed to retry run' });
  }
});

systemReportsRouter.get('/runs/:runId/artifacts/:artifactId/download', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const user = (req as AuthenticatedRequest).user!;
    const { runId, artifactId } = req.params;

    const result = await getArtifact(runId, artifactId);

    if (!result) {
      res.status(404).json({ error: 'Artifact not found', code: 'ARTIFACT_NOT_FOUND' });
      return;
    }

    const hash = createHash('sha256').update(result.content).digest('hex');

    res.setHeader('Content-Type', result.artifact.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.artifact.fileName}"`);
    res.setHeader('Content-Length', result.artifact.sizeBytes);
    res.setHeader('X-Content-SHA256', hash);

    res.send(result.content);
  } catch (error) {
    console.error('Error downloading artifact:', error);
    if (error instanceof Error && error.message === 'Artifact file missing') {
      res.status(404).json({ error: 'Artifact file missing', code: 'ARTIFACT_FILE_MISSING' });
      return;
    }
    res.status(500).json({ error: 'Failed to download artifact' });
  }
});
