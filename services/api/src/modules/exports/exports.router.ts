import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { User } from '@prisma/client';
import {
  getExportPresets,
  createExportPreset,
  updateExportPreset,
  deleteExportPreset,
  exportParticipants,
  exportTeams,
  generateAvatarBundle,
  generateCsvContent,
  generateJsonContent,
  type ExportConfig,
} from './exports.service.js';
import { logger } from '../../common/logger.js';

export const exportsRouter = Router();

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;

async function getManagedEventIds(user: User): Promise<string[] | null> {
  if (['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(user.role)) return null;

  const memberships = await prisma.eventMember.findMany({
    where: { userId: user.id, role: 'EVENT_ADMIN', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    select: { eventId: true },
  });

  return memberships.map(m => m.eventId);
}

const createPresetSchema = z.object({
  eventId: z.string().nullable(),
  scope: z.enum(['participants', 'volunteers', 'teams', 'team_members', 'all']),
  name: z.string().min(1),
  format: z.enum(['csv', 'xlsx', 'json']),
  config: z.object({
    scope: z.string(),
    fields: z.array(z.string()),
    format: z.string(),
    filters: z.object({
      status: z.array(z.string()).optional(),
      hasTeam: z.boolean().optional(),
      hasPhoto: z.boolean().optional(),
    }).optional(),
  }),
});

const runExportSchema = z.object({
  scope: z.enum(['participants', 'volunteers', 'teams', 'team_members', 'all']),
  format: z.enum(['csv', 'xlsx', 'json']),
  fields: z.array(z.string()).optional(),
  filters: z.object({
    status: z.array(z.string()).optional(),
    hasTeam: z.boolean().optional(),
    hasPhoto: z.boolean().optional(),
  }).optional(),
});

const avatarBundleSchema = z.object({
  includeApprovedOnly: z.boolean().optional().default(false),
  includeTeamsOnly: z.boolean().optional().default(false),
  includeVolunteers: z.boolean().optional().default(false),
});

// GET /api/admin/events/:eventId/exports/presets
exportsRouter.get('/events/:eventId/exports/presets', async (req, res) => {
  const user = (req as any).user as User;
  const { eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const presets = await getExportPresets(eventId);
  res.json({ data: presets });
});

// POST /api/admin/events/:eventId/exports/presets
exportsRouter.post('/events/:eventId/exports/presets', async (req, res) => {
  const user = (req as any).user as User;
  const { eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const parsed = createPresetSchema.safeParse({ ...req.body, eventId });
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const preset = await createExportPreset(
    {
      eventId: parsed.data.eventId,
      scope: parsed.data.scope,
      name: parsed.data.name,
      format: parsed.data.format,
      config: parsed.data.config as any,
    },
    user.id
  );
  res.status(201).json({ data: preset });
});

// PATCH /api/admin/events/:eventId/exports/presets/:presetId
exportsRouter.patch('/events/:eventId/exports/presets/:presetId', async (req, res) => {
  const user = (req as any).user as User;
  const { eventId, presetId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const preset = await prisma.exportPreset.findUnique({
    where: { id: presetId },
  });

  if (!preset) {
    res.status(404).json({ error: 'Preset not found' });
    return;
  }

  const { name, format, config } = req.body;
  const updated = await updateExportPreset(presetId, { name, format, config });
  res.json({ data: updated });
});

// DELETE /api/admin/events/:eventId/exports/presets/:presetId
exportsRouter.delete('/events/:eventId/exports/presets/:presetId', async (req, res) => {
  const user = (req as any).user as User;
  const { eventId, presetId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  await deleteExportPreset(presetId);
  res.status(204).send();
});

// POST /api/admin/events/:eventId/exports/run
exportsRouter.post('/events/:eventId/exports/run', async (req, res) => {
  const user = (req as any).user as User;
  const { eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const parsed = runExportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const config: ExportConfig = {
    scope: parsed.data.scope as any,
    fields: parsed.data.fields ?? ['*'],
    format: parsed.data.format as any,
    filters: parsed.data.filters,
  };

  logger.info('Export started', {
    module: 'exports',
    action: 'EXPORT_STARTED',
    userId: user.id,
    meta: { eventId, eventTitle: event.title, scope: config.scope, format: config.format },
  });

  let data: any[];
  if (config.scope === 'participants' || config.scope === 'all') {
    data = await exportParticipants(eventId, config);
  } else if (config.scope === 'teams') {
    data = await exportTeams(eventId, config);
  } else {
    data = [];
  }

  if (config.format === 'json') {
    const jsonContent = generateJsonContent(data);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="export_${eventId}_${config.scope}.json"`);
    res.send(jsonContent);
    return;
  }

  const columns = Object.keys(data[0] || {});
  const csvContent = generateCsvContent(data, columns);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="export_${eventId}_${config.scope}.csv"`);
  res.send(csvContent);
});

// POST /api/admin/events/:eventId/exports/avatar-bundle
exportsRouter.post('/events/:eventId/exports/avatar-bundle', async (req, res) => {
  const user = (req as any).user as User;
  const { eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });

  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const managedEventIds = await getManagedEventIds(user);
  if (managedEventIds && !managedEventIds.includes(eventId)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const parsed = avatarBundleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const bundle = await generateAvatarBundle(eventId, parsed.data);

  logger.info('Avatar bundle requested', {
    module: 'exports',
    action: 'AVATAR_BUNDLE_REQUESTED',
    userId: user.id,
    meta: { eventId, eventTitle: event.title, participantsCount: bundle.participants.length },
  });

  res.json({
    jobId: bundle.jobId,
    format: bundle.format,
    contains: bundle.contains,
    participantsCount: bundle.participants.length,
    missingAvatarsCount: bundle.participants.filter((p: any) => p.missingAvatar).length,
  });
});
