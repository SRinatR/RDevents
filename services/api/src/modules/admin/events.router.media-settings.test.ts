import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mediaServiceMocks = vi.hoisted(() => ({
  updateEventMediaSettings: vi.fn(),
  handleEventMediaMulterUpload: vi.fn(() => (_req: any, _res: any, next: () => void) => next()),
}));

vi.mock('../../common/middleware.js', () => ({
  canManageEvent: vi.fn(),
  requirePlatformAdmin: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'admin-1', email: 'admin@example.com' };
    next();
  },
}));

vi.mock('../access-control/access-control.service.js', () => ({
  canAccessEvent: vi.fn(async () => true),
  canManageWorkspace: vi.fn(),
  createDirectEventStaffGrant: vi.fn(),
  getManagedEventIds: vi.fn(),
  recalculateEventStaffAccess: vi.fn(),
  revokeEventStaffGrant: vi.fn(),
  applyActiveWorkspacePoliciesToEvent: vi.fn(),
}));

vi.mock('../events/event-media.service.js', () => ({
  deleteEventMedia: vi.fn(),
  EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB: 50,
  EventMediaUploadError: class EventMediaUploadError extends Error {},
  getEventMediaSettings: vi.fn(),
  getEventMediaSummary: vi.fn(),
  handleEventMediaMulterUpload: mediaServiceMocks.handleEventMediaMulterUpload,
  listEventMediaForModeration: vi.fn(),
  moderateEventMedia: vi.fn(),
  updateEventMediaSettings: mediaServiceMocks.updateEventMediaSettings,
  uploadEventMedia: vi.fn(),
}));

vi.mock('../../db/prisma.js', () => ({ prisma: {} }));
vi.mock('../../common/storage.js', () => ({ buildPublicMediaUrl: vi.fn() }));
vi.mock('../events/events.schemas.js', () => ({ createEventSchema: { parse: (x: any) => x }, updateEventSchema: { parse: (x: any) => x } }));
vi.mock('../analytics/analytics.service.js', () => ({ trackAnalyticsEvent: vi.fn() }));
vi.mock('../events/notifications.service.js', () => ({ notifyParticipantStatusChanged: vi.fn() }));
vi.mock('../events/events.service.js', () => ({ approveTeamChangeRequest: vi.fn(), rejectTeamChangeRequest: vi.fn() }));
vi.mock('../profile-config/profile-field-values.js', () => ({ getActiveProfileRequirementFields: vi.fn(() => []) }));
vi.mock('@event-platform/shared', () => ({ normalizeEmail: (v: string) => v }));
vi.mock('./team-override.service.js', () => ({
  adminAddTeamMember: vi.fn(), adminRemoveTeamMember: vi.fn(), adminReplaceTeamMember: vi.fn(), adminReplaceTeamRoster: vi.fn(), adminTransferTeamCaptain: vi.fn(), adminUpdateTeamDetails: vi.fn(),
}));
vi.mock('./teams.schemas.js', () => ({ adminTeamMemberSchema: {}, replaceAdminTeamMemberSchema: {}, replaceAdminTeamRosterSchema: {}, transferAdminTeamCaptainSchema: {}, updateAdminTeamSchema: {} }));
vi.mock('../access-control/access-control.audit.js', () => ({ buildAuditRequestContext: vi.fn(), writeAuditLog: vi.fn() }));
vi.mock('../../config/env.js', () => ({ env: {} }));

const { adminEventsRouter } = await import('./events.router.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/events', adminEventsRouter);
  return app;
}

describe('admin events media settings validation', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 for empty allowedTypes', async () => {
    mediaServiceMocks.updateEventMediaSettings.mockRejectedValue(new Error('EVENT_MEDIA_ALLOWED_TYPES_REQUIRED'));

    const res = await request(app).patch('/api/admin/events/event-1/media/settings').send({ allowedTypes: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_MEDIA_ALLOWED_TYPES_REQUIRED');
  });

  it('accepts one allowed type', async () => {
    mediaServiceMocks.updateEventMediaSettings.mockResolvedValue({ allowedTypes: ['image'] });

    const res = await request(app).patch('/api/admin/events/event-1/media/settings').send({ allowedTypes: ['image'] });

    expect(res.status).toBe(200);
    expect(res.body.settings.allowedTypes).toEqual(['image']);
  });

  it('accepts both allowed types', async () => {
    mediaServiceMocks.updateEventMediaSettings.mockResolvedValue({ allowedTypes: ['image', 'video'] });

    const res = await request(app).patch('/api/admin/events/event-1/media/settings').send({ allowedTypes: ['image', 'video'] });

    expect(res.status).toBe(200);
    expect(res.body.settings.allowedTypes).toEqual(['image', 'video']);
  });
});
