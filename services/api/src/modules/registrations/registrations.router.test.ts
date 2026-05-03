import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const eventMediaMocks = vi.hoisted(() => ({
  listMyEventMedia: vi.fn(),
  uploadEventMedia: vi.fn(),
  handleEventMediaMulterUpload: vi.fn(() => (_req: any, _res: any, next: () => void) => next()),
  EventMediaUploadError: class EventMediaUploadError extends Error {
    code: string;
    constructor(message: string, code = 'INVALID_MEDIA') {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('../../common/middleware.js', () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', email: 'u@example.com' };
    next();
  },
}));

vi.mock('../events/event-media.service.js', () => ({
  EVENT_MEDIA_HARD_MAX_FILE_SIZE_MB: 50,
  EventMediaUploadError: eventMediaMocks.EventMediaUploadError,
  handleEventMediaMulterUpload: eventMediaMocks.handleEventMediaMulterUpload,
  listMyEventMedia: eventMediaMocks.listMyEventMedia,
  uploadEventMedia: eventMediaMocks.uploadEventMedia,
}));

vi.mock('../events/events.service.js', () => ({
  acceptTeamInvitation: vi.fn(),
  declineTeamInvitation: vi.fn(),
  getMyEventWorkspace: vi.fn(),
  getMyEvents: vi.fn(),
  getMyParticipantApplications: vi.fn(),
  getMyTeams: vi.fn(),
  getMyVolunteerApplications: vi.fn(),
  listMyTeamInvitations: vi.fn(),
  RegistrationRequirementsError: class RegistrationRequirementsError extends Error {
    missingFields: string[] = [];
  },
}));

const { registrationsRouter } = await import('./registrations.router.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/me', registrationsRouter);
  return app;
}

describe('registrationsRouter media upload errors', () => {
  const app = createApp();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 EVENT_MEDIA_BANK_DISABLED for participant upload', async () => {
    eventMediaMocks.uploadEventMedia.mockRejectedValue(new Error('EVENT_MEDIA_BANK_DISABLED'));

    const res = await request(app).post('/api/me/events/event-1/media').send({});

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'Media bank is disabled for this event',
      code: 'EVENT_MEDIA_BANK_DISABLED',
    });
  });

  it('returns 403 EVENT_MEDIA_UPLOAD_DISABLED for participant upload', async () => {
    eventMediaMocks.uploadEventMedia.mockRejectedValue(new Error('EVENT_MEDIA_UPLOAD_DISABLED'));

    const res = await request(app).post('/api/me/events/event-1/media').send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_UPLOAD_DISABLED');
  });

  it('returns 403 EVENT_MEDIA_UPLOAD_FORBIDDEN for non-participant upload', async () => {
    eventMediaMocks.uploadEventMedia.mockRejectedValue(new Error('EVENT_MEDIA_UPLOAD_FORBIDDEN'));

    const res = await request(app).post('/api/me/events/event-1/media').send({});

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_UPLOAD_FORBIDDEN');
  });
});
