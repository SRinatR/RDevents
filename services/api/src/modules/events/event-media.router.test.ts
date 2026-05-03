import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  event: {
    findUnique: vi.fn(),
  },
  eventMediaSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  eventMember: {
    findUnique: vi.fn(),
  },
  eventMedia: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  mediaAsset: {
    create: vi.fn(),
    update: vi.fn(),
  },
  eventMediaHistory: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));

const accessMocks = vi.hoisted(() => ({
  applyActiveWorkspacePoliciesToEvent: vi.fn(),
  canAccessEvent: vi.fn(),
  canManageWorkspace: vi.fn(),
  createDirectEventStaffGrant: vi.fn(),
  getManagedEventIds: vi.fn(),
  recalculateEventStaffAccess: vi.fn(),
  revokeEventStaffGrant: vi.fn(),
}));

vi.mock('../../db/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../access-control/access-control.service.js', () => accessMocks);

vi.mock('../../common/storage.js', () => ({
  buildPublicMediaUrl: vi.fn((key: string) => `https://cdn.example.test/${key}`),
  getMediaUploadDir: vi.fn(() => 'uploads'),
  saveUploadedFile: vi.fn(),
}));

const { createApp } = await import('../../app.js');
const { signAccessToken } = await import('../../common/jwt.js');

const app = createApp();

const defaultSettings = {
  enabled: true,
  participantUploadEnabled: true,
  moderationEnabled: true,
  showUploaderName: false,
  showCredit: true,
  allowParticipantTitle: true,
  allowParticipantCaption: true,
  maxFileSizeMb: 25,
  allowedTypes: ['image', 'video'],
};

const testUser = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  role: 'USER',
  isActive: true,
};

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'PLATFORM_ADMIN',
  isActive: true,
};

function authHeader(user = testUser) {
  return `Bearer ${signAccessToken({ sub: user.id, email: user.email, role: user.role })}`;
}

function mediaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'media-1',
    eventId: 'event-1',
    source: 'PARTICIPANT',
    status: 'APPROVED',
    title: null,
    caption: null,
    altText: null,
    credit: 'Author Name',
    moderationNotes: null,
    approvedAt: new Date('2026-01-01T10:00:00.000Z'),
    rejectedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T09:00:00.000Z'),
    updatedAt: new Date('2026-01-01T09:00:00.000Z'),
    asset: {
      id: 'asset-1',
      originalFilename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      publicUrl: 'https://cdn.example.test/photo.jpg',
      storageKey: 'photo.jpg',
      status: 'ACTIVE',
    },
    uploader: {
      id: testUser.id,
      name: testUser.name,
      email: testUser.email,
      avatarUrl: null,
    },
    approvedBy: null,
    rejectedBy: null,
    history: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue(testUser);
  prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1', status: 'PUBLISHED' });
  prismaMock.eventMediaSettings.findUnique.mockResolvedValue(defaultSettings);
  prismaMock.eventMediaSettings.upsert.mockResolvedValue(defaultSettings);
  prismaMock.eventMember.findUnique.mockResolvedValue({ status: 'ACTIVE' });
  prismaMock.eventMedia.count.mockResolvedValue(0);
  prismaMock.eventMedia.findMany.mockResolvedValue([]);
  accessMocks.canAccessEvent.mockResolvedValue(false);
});

describe('public event media privacy', () => {
  it('GET /api/events/:eventId/media hides credit when showCredit is false', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, showCredit: false });
    prismaMock.eventMedia.findMany.mockResolvedValue([mediaRow({ credit: 'Secret credit' })]);

    const res = await request(app).get('/api/events/event-1/media?limit=1&cursor=ignored');
    const query = prismaMock.eventMedia.findMany.mock.calls[0][0];

    expect(res.status).toBe(200);
    expect(res.body.media[0].credit).toBeNull();
    expect(res.body.meta.nextCursor).toBeNull();
    expect(query.take).toBe(1);
    expect(query.cursor).toBeUndefined();
    expect(query.skip).toBeUndefined();
    expect(query.orderBy).toEqual([{ approvedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('GET /api/events/:eventId/media shows credit when showCredit is true', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, showCredit: true });
    prismaMock.eventMedia.findMany.mockResolvedValue([mediaRow({ credit: 'Author Name' })]);

    const res = await request(app).get('/api/events/event-1/media?limit=1');

    expect(res.status).toBe(200);
    expect(res.body.media[0].credit).toBe('Author Name');
  });

  it('GET /api/events/media/highlights applies event media settings', async () => {
    prismaMock.eventMedia.findMany.mockResolvedValue([
      mediaRow({
        credit: 'Hidden credit',
        event: {
          id: 'event-1',
          slug: 'event-one',
          title: 'Event One',
          startsAt: new Date('2026-01-01T10:00:00.000Z'),
          mediaSettings: {
            ...defaultSettings,
            showCredit: false,
            showUploaderName: false,
          },
        },
      }),
    ]);

    const res = await request(app).get('/api/events/media/highlights?limit=8');
    const query = prismaMock.eventMedia.findMany.mock.calls[0][0];

    expect(res.status).toBe(200);
    expect(res.body.media[0].credit).toBeNull();
    expect(res.body.media[0].uploader).toBeNull();
    expect(res.body.media[0].event).toEqual({
      id: 'event-1',
      slug: 'event-one',
      title: 'Event One',
      startsAt: '2026-01-01T10:00:00.000Z',
    });
    expect(query.include.event.select.mediaSettings).toBe(true);
    expect(query.orderBy).toEqual([{ approvedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]);
  });
});

describe('participant media upload errors', () => {
  it('POST /api/me/events/:eventId/media returns EVENT_MEDIA_BANK_DISABLED', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, enabled: false, participantUploadEnabled: true });

    const res = await request(app)
      .post('/api/me/events/event-1/media')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('photo'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_BANK_DISABLED');
  });

  it('POST /api/me/events/:eventId/media returns EVENT_MEDIA_UPLOAD_DISABLED', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, participantUploadEnabled: false });

    const res = await request(app)
      .post('/api/me/events/event-1/media')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('photo'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_UPLOAD_DISABLED');
  });

  it('POST /api/me/events/:eventId/media returns EVENT_MEDIA_UPLOAD_FORBIDDEN for a non-participant', async () => {
    prismaMock.eventMember.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/me/events/event-1/media')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('photo'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_UPLOAD_FORBIDDEN');
  });
});

describe('admin media settings allowedTypes validation', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(adminUser);
    accessMocks.canAccessEvent.mockResolvedValue(true);
  });

  it('PATCH /api/admin/events/:id/media/settings rejects empty allowedTypes', async () => {
    const res = await request(app)
      .patch('/api/admin/events/event-1/media/settings')
      .set('Authorization', authHeader(adminUser))
      .send({ allowedTypes: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_MEDIA_ALLOWED_TYPES_REQUIRED');
    expect(prismaMock.eventMediaSettings.upsert).not.toHaveBeenCalled();
  });

  it('PATCH /api/admin/events/:id/media/settings accepts image-only allowedTypes', async () => {
    prismaMock.eventMediaSettings.upsert.mockResolvedValue({ ...defaultSettings, allowedTypes: ['image'] });

    const res = await request(app)
      .patch('/api/admin/events/event-1/media/settings')
      .set('Authorization', authHeader(adminUser))
      .send({ allowedTypes: ['image'] });

    expect(res.status).toBe(200);
    expect(res.body.settings.allowedTypes).toEqual(['image']);
  });

  it('PATCH /api/admin/events/:id/media/settings accepts video-only allowedTypes', async () => {
    prismaMock.eventMediaSettings.upsert.mockResolvedValue({ ...defaultSettings, allowedTypes: ['video'] });

    const res = await request(app)
      .patch('/api/admin/events/event-1/media/settings')
      .set('Authorization', authHeader(adminUser))
      .send({ allowedTypes: ['video'] });

    expect(res.status).toBe(200);
    expect(res.body.settings.allowedTypes).toEqual(['video']);
  });

  it('PATCH /api/admin/events/:id/media/settings rejects invalid-only allowedTypes', async () => {
    const res = await request(app)
      .patch('/api/admin/events/event-1/media/settings')
      .set('Authorization', authHeader(adminUser))
      .send({ allowedTypes: ['pdf', 'doc'] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_MEDIA_ALLOWED_TYPES_REQUIRED');
  });
});

describe('admin event media summary', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(adminUser);
    accessMocks.canAccessEvent.mockResolvedValue(true);
  });

  it('GET /api/admin/events/:id/media/summary counts all media for the requested event', async () => {
    prismaMock.eventMedia.count
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3);

    const res = await request(app)
      .get('/api/admin/events/event-1/media/summary?status=PENDING&type=image')
      .set('Authorization', authHeader(adminUser));

    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      pending: 2,
      approved: 3,
      rejected: 1,
      deleted: 1,
      participant: 4,
      admin: 3,
      images: 4,
      videos: 3,
    });
    expect(res.body.summary.total).toBe(7);
    for (const call of prismaMock.eventMedia.count.mock.calls) {
      expect(call[0].where.eventId).toBe('event-1');
    }
  });

  it('GET /api/admin/events/:id/media/summary enforces regular, event-admin, and platform-admin access', async () => {
    accessMocks.canAccessEvent
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    const regular = await request(app)
      .get('/api/admin/events/event-1/media/summary')
      .set('Authorization', authHeader({ ...testUser, id: 'regular-1', email: 'regular@example.com' }));
    const eventAdmin = await request(app)
      .get('/api/admin/events/event-1/media/summary')
      .set('Authorization', authHeader({ ...testUser, id: 'event-admin-1', email: 'event-admin@example.com' }));
    const platformAdmin = await request(app)
      .get('/api/admin/events/event-1/media/summary')
      .set('Authorization', authHeader(adminUser));

    expect(regular.status).toBe(403);
    expect(eventAdmin.status).toBe(200);
    expect(platformAdmin.status).toBe(200);
  });
});
