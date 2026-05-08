import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  event: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  eventMediaSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  eventMember: {
    findUnique: vi.fn(),
  },
  eventMedia: {
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
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

const storageMocks = vi.hoisted(() => ({
  saveUploadedFile: vi.fn(),
}));

vi.mock('../../db/prisma.js', () => ({
  prisma: prismaMock,
}));

vi.mock('../access-control/access-control.service.js', () => accessMocks);

vi.mock('../../common/storage.js', () => ({
  buildPublicMediaUrl: vi.fn((key: string) => `https://cdn.example.test/${key}`),
  getMediaUploadDir: vi.fn(() => 'uploads'),
  saveUploadedFile: storageMocks.saveUploadedFile,
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
  nextMediaDisplayNumber: 2,
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
    displayNumber: 1,
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

function publicEventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    slug: 'event-one',
    title: 'Event One',
    startsAt: new Date('2026-01-01T10:00:00.000Z'),
    endsAt: new Date('2026-01-01T12:00:00.000Z'),
    location: 'Tashkent',
    coverImageUrl: 'https://cdn.example.test/cover.jpg',
    mediaSettings: defaultSettings,
    ...overrides,
  };
}

function mediaRows(count: number, overrides: Record<string, unknown> = {}) {
  return Array.from({ length: count }, (_, index) => mediaRow({
    id: `media-${index + 1}`,
    asset: {
      id: `asset-${index + 1}`,
      originalFilename: `media-${index + 1}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      publicUrl: `https://cdn.example.test/media-${index + 1}.jpg`,
      storageKey: `media-${index + 1}.jpg`,
      status: 'ACTIVE',
    },
    ...overrides,
  }));
}

function rawMediaRows(count: number, overrides: Record<string, unknown> = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `media-${index + 1}`,
    eventId: 'event-1',
    source: 'PARTICIPANT',
    status: 'APPROVED',
    displayNumber: index + 1,
    title: null,
    caption: null,
    altText: null,
    credit: 'Author Name',
    albumId: null,
    albumTitle: null,
    capturedAt: null,
    capturedAtSource: null,
    capturedTimezone: null,
    groupKey: null,
    groupTitle: null,
    downloadEnabled: true,
    durationSeconds: null,
    metadataJson: null,
    moderationNotes: null,
    approvedAt: new Date('2026-01-01T10:00:00.000Z'),
    rejectedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T09:00:00.000Z'),
    updatedAt: new Date('2026-01-01T09:00:00.000Z'),
    assetId: `asset-${index + 1}`,
    assetOriginalFilename: `media-${index + 1}.jpg`,
    assetMimeType: 'image/jpeg',
    assetSizeBytes: 1024,
    assetPublicUrl: `https://cdn.example.test/media-${index + 1}.jpg`,
    assetStorageKey: `media-${index + 1}.jpg`,
    assetChecksumSha256: 'checksum',
    uploaderId: testUser.id,
    uploaderName: testUser.name,
    uploaderEmail: testUser.email,
    uploaderAvatarUrl: null,
    approvedById: null,
    approvedByName: null,
    approvedByEmail: null,
    rejectedById: null,
    rejectedByName: null,
    rejectedByEmail: null,
    ...overrides,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue(testUser);
  prismaMock.event.count.mockResolvedValue(0);
  prismaMock.event.findFirst.mockResolvedValue(null);
  prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1', status: 'PUBLISHED' });
  prismaMock.event.findMany.mockResolvedValue([]);
  prismaMock.eventMediaSettings.findUnique.mockResolvedValue(defaultSettings);
  prismaMock.eventMediaSettings.upsert.mockResolvedValue(defaultSettings);
  prismaMock.eventMember.findUnique.mockResolvedValue({ status: 'ACTIVE' });
  prismaMock.eventMedia.count.mockResolvedValue(0);
  prismaMock.eventMedia.aggregate.mockResolvedValue({ _max: { displayNumber: null } });
  prismaMock.eventMedia.create.mockResolvedValue({ id: 'media-created' });
  prismaMock.eventMedia.findMany.mockResolvedValue([]);
  prismaMock.eventMedia.findUnique.mockResolvedValue(mediaRow({ id: 'media-created' }));
  prismaMock.eventMediaHistory.create.mockResolvedValue({});
  prismaMock.mediaAsset.create.mockResolvedValue({ id: 'asset-created' });
  prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
  storageMocks.saveUploadedFile.mockResolvedValue({
    storageDriver: 'local',
    storageKey: 'events/event-1/media/photo.jpg',
    publicUrl: 'https://cdn.example.test/events/event-1/media/photo.jpg',
  });
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

  it('GET /api/events/:eventId/media returns empty media when the media bank is disabled', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, enabled: false });

    const res = await request(app).get('/api/events/event-1/media');

    expect(res.status).toBe(200);
    expect(res.body.media).toEqual([]);
    expect(res.body.meta).toMatchObject({
      nextCursor: null,
      settings: { enabled: false },
    });
    expect(prismaMock.eventMedia.findMany).not.toHaveBeenCalled();
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
    expect(query.where.event.mediaSettings).toEqual({ is: { enabled: true } });
    expect(query.include.event.select.mediaSettings).toBe(true);
    expect(query.orderBy).toEqual([{ approvedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('GET /api/events/media lists only public media from published enabled events', async () => {
    prismaMock.eventMedia.count.mockResolvedValue(1);
    prismaMock.event.findMany.mockResolvedValue([{ id: 'event-1', slug: 'event-one', title: 'Event One', startsAt: new Date('2026-01-01T10:00:00.000Z') }]);
    prismaMock.eventMedia.findMany.mockResolvedValue([
      mediaRow({
        event: {
          id: 'event-1',
          slug: 'event-one',
          title: 'Event One',
          startsAt: new Date('2026-01-01T10:00:00.000Z'),
          mediaSettings: defaultSettings,
        },
      }),
    ]);

    const res = await request(app).get('/api/events/media?type=image&search=1');
    const query = prismaMock.eventMedia.findMany.mock.calls[0][0];

    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(1);
    expect(res.body.events).toHaveLength(1);
    expect(query.where.event).toMatchObject({
      status: 'PUBLISHED',
      deletedAt: null,
      mediaSettings: { is: { enabled: true } },
    });
    expect(query.where.asset).toMatchObject({
      status: 'ACTIVE',
      mimeType: { startsWith: 'image/' },
    });
  });

  it('GET /api/events/:slug/media-bank paginates and returns global counters', async () => {
    prismaMock.event.findFirst.mockResolvedValue(publicEventRow());
    prismaMock.eventMedia.count
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(291)
      .mockResolvedValueOnce(9);
    prismaMock.eventMedia.findMany.mockResolvedValue(mediaRows(80));

    const res = await request(app).get('/api/events/event-one/media-bank?limit=80&page=1&type=all');
    const query = prismaMock.eventMedia.findMany.mock.calls[0][0];

    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(80);
    expect(res.body.meta).toMatchObject({
      total: 300,
      filteredTotal: 300,
      images: 291,
      videos: 9,
      page: 1,
      limit: 80,
      pages: 4,
    });
    expect(query.skip).toBe(0);
    expect(query.take).toBe(80);
  });

  it('GET /api/events/:slug/media-bank keeps global counters for the video filter', async () => {
    prismaMock.event.findFirst.mockResolvedValue(publicEventRow());
    prismaMock.eventMedia.count
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(291)
      .mockResolvedValueOnce(9);
    prismaMock.eventMedia.findMany.mockResolvedValue(mediaRows(9, {
      asset: {
        id: 'asset-video',
        originalFilename: 'video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 4096,
        publicUrl: 'https://cdn.example.test/video.mp4',
        storageKey: 'video.mp4',
        status: 'ACTIVE',
      },
    }));

    const res = await request(app).get('/api/events/event-one/media-bank?limit=80&page=1&type=video');
    const query = prismaMock.eventMedia.findMany.mock.calls[0][0];

    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(9);
    expect(res.body.meta).toMatchObject({
      total: 300,
      filteredTotal: 9,
      images: 291,
      videos: 9,
      page: 1,
      limit: 80,
      pages: 1,
    });
    expect(query.where.asset).toMatchObject({
      status: 'ACTIVE',
      mimeType: { startsWith: 'video/' },
    });
  });

  it('GET /api/events/media/albums returns event album counters from the full result set', async () => {
    const event = publicEventRow();
    prismaMock.event.count.mockResolvedValue(1);
    prismaMock.event.findMany.mockResolvedValue([event]);
    prismaMock.eventMedia.count
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(291)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(291)
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(120);
    prismaMock.eventMedia.findMany
      .mockResolvedValueOnce(mediaRows(4, { event }))
      .mockResolvedValueOnce([
        { asset: { sizeBytes: 1024 } },
        { asset: { sizeBytes: 2048 } },
      ]);

    const res = await request(app).get('/api/events/media/albums?limit=20&page=1');

    expect(res.status).toBe(200);
    expect(res.body.albums).toHaveLength(1);
    expect(res.body.albums[0].counts).toMatchObject({
      total: 300,
      images: 291,
      videos: 9,
      organizers: 120,
    });
    expect(res.body.albums[0].previewMedia.length).toBeLessThanOrEqual(4);
    expect(res.body.albums[0].totalSizeBytes).toBe(3072);
    expect(res.body.meta).toMatchObject({
      totalAlbums: 1,
      totalMedia: 300,
      images: 291,
      videos: 9,
      organizers: 120,
      page: 1,
      limit: 20,
      pages: 1,
    });
  });

  it('GET /api/events/media/albums applies the organizer source filter on the backend', async () => {
    const event = publicEventRow();
    prismaMock.event.count.mockResolvedValue(1);
    prismaMock.event.findMany.mockResolvedValue([event]);
    prismaMock.eventMedia.count
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(118)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(118)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(120);
    prismaMock.eventMedia.findMany
      .mockResolvedValueOnce(mediaRows(4, { event, source: 'ADMIN' }))
      .mockResolvedValueOnce([{ asset: { sizeBytes: 1024 } }]);

    const res = await request(app).get('/api/events/media/albums?source=admin');
    const previewQuery = prismaMock.eventMedia.findMany.mock.calls[0][0];

    expect(res.status).toBe(200);
    expect(res.body.albums[0].previewMedia.every((item: any) => item.source === 'ADMIN')).toBe(true);
    expect(res.body.albums[0].counts.organizers).toBe(120);
    expect(res.body.meta.organizers).toBe(120);
    expect(previewQuery.where.source).toBe('ADMIN');
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

describe('admin media list pagination', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(adminUser);
    accessMocks.canAccessEvent.mockResolvedValue(true);
  });

  it('GET /api/admin/events/:id/media returns requested page metadata', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ total: BigInt(300) }])
      .mockResolvedValueOnce(rawMediaRows(80));

    const res = await request(app)
      .get('/api/admin/events/event-1/media?status=ALL&limit=80&page=2')
      .set('Authorization', authHeader(adminUser));

    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(80);
    expect(res.body.meta).toMatchObject({
      total: 300,
      page: 2,
      limit: 80,
      pages: 4,
    });
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('POST /api/admin/events/:id/media/reset-counter aligns next display number', async () => {
    prismaMock.eventMedia.aggregate.mockResolvedValue({ _max: { displayNumber: 387 } });
    prismaMock.eventMediaSettings.upsert.mockResolvedValue({ ...defaultSettings, nextMediaDisplayNumber: 388 });

    const res = await request(app)
      .post('/api/admin/events/event-1/media/reset-counter')
      .set('Authorization', authHeader(adminUser));

    expect(res.status).toBe(200);
    expect(res.body.nextMediaDisplayNumber).toBe(388);
    expect(prismaMock.eventMedia.aggregate).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
      _max: { displayNumber: true },
    });
    expect(prismaMock.eventMediaSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: 'event-1' },
      update: { nextMediaDisplayNumber: 388 },
    }));
  });
});

describe('admin media upload', () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(adminUser);
    accessMocks.canAccessEvent.mockResolvedValue(true);
  });

  it('POST /api/admin/events/:id/media allows organizer upload when the media bank is disabled', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, enabled: false });
    prismaMock.eventMedia.findUnique.mockResolvedValue(mediaRow({
      id: 'media-created',
      source: 'ADMIN',
      status: 'APPROVED',
      uploader: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        avatarUrl: null,
      },
      approvedBy: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        avatarUrl: null,
      },
    }));

    const res = await request(app)
      .post('/api/admin/events/event-1/media')
      .set('Authorization', authHeader(adminUser))
      .attach('file', Buffer.from('photo'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.media.source).toBe('ADMIN');
    expect(res.body.media.status).toBe('APPROVED');
    expect(prismaMock.eventMedia.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        source: 'ADMIN',
        status: 'APPROVED',
        displayNumber: 1,
      }),
    }));
  });

  it('POST /api/admin/events/:id/media still rejects invalid file types when the media bank is disabled', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, enabled: false });

    const res = await request(app)
      .post('/api/admin/events/event-1/media')
      .set('Authorization', authHeader(adminUser))
      .attach('file', Buffer.from('pdf'), { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_MEDIA_FILE_TYPE_NOT_ALLOWED');
    expect(storageMocks.saveUploadedFile).not.toHaveBeenCalled();
  });

  it('POST /api/admin/events/:id/media still rejects files above the event max size when the media bank is disabled', async () => {
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, enabled: false, maxFileSizeMb: 1 });

    const res = await request(app)
      .post('/api/admin/events/event-1/media')
      .set('Authorization', authHeader(adminUser))
      .attach('file', Buffer.alloc(1024 * 1024 + 1), { filename: 'large.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_MEDIA_FILE_TOO_LARGE');
    expect(storageMocks.saveUploadedFile).not.toHaveBeenCalled();
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
      .mockResolvedValueOnce(6)
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
      activeTotal: 6,
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

  it('GET /api/admin/events/:id/media/public-visibility explains why media is not public', async () => {
    prismaMock.event.findUnique.mockResolvedValue({ id: 'event-1', status: 'DRAFT', deletedAt: null });
    prismaMock.eventMediaSettings.findUnique.mockResolvedValue({ ...defaultSettings, enabled: true });
    prismaMock.eventMedia.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const res = await request(app)
      .get('/api/admin/events/event-1/media/public-visibility')
      .set('Authorization', authHeader(adminUser));

    expect(res.status).toBe(200);
    expect(res.body.visibility).toMatchObject({
      eventPublished: false,
      mediaBankEnabled: true,
      approvedMedia: 1,
      activeAssets: 1,
      visibleOnPublicPages: false,
      reasonCode: 'EVENT_NOT_PUBLISHED',
    });
  });
});
