import request from 'supertest';
import { randomUUID } from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { EventMediaSource, EventMediaStatus, UserRole } from '@prisma/client';
import { createApp } from '../../app.js';
import { signAccessToken } from '../../common/jwt.js';
import { prisma } from '../../db/prisma.js';

const app = createApp();

const created = {
  users: [] as string[],
  events: [] as string[],
  assets: [] as string[],
  media: [] as string[],
};

function unique(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

async function cleanup() {
  await prisma.eventMediaHistory.deleteMany({ where: { mediaId: { in: created.media } } });
  await prisma.eventMedia.deleteMany({ where: { id: { in: created.media } } });
  await prisma.mediaAsset.deleteMany({ where: { id: { in: created.assets } } });
  await prisma.eventMediaSettings.deleteMany({ where: { eventId: { in: created.events } } });
  await prisma.eventStaffAccess.deleteMany({ where: { eventId: { in: created.events } } });
  await prisma.eventStaffGrant.deleteMany({ where: { eventId: { in: created.events } } });
  await prisma.eventMember.deleteMany({ where: { eventId: { in: created.events } } });
  await prisma.event.deleteMany({ where: { id: { in: created.events } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  created.users = [];
  created.events = [];
  created.assets = [];
  created.media = [];
}

afterEach(async () => {
  await cleanup();
});

async function createUser(role: UserRole = 'USER') {
  const user = await prisma.user.create({
    data: {
      email: `${unique('media-test')}@example.com`,
      name: 'Media Test User',
      role,
      emailVerifiedAt: new Date(),
    },
  });
  created.users.push(user.id);
  return user;
}

function authHeader(user: { id: string; email: string; role: string }) {
  return `Bearer ${signAccessToken({ sub: user.id, email: user.email, role: user.role })}`;
}

async function createEvent(options: { status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'; createdById?: string } = {}) {
  const event = await prisma.event.create({
    data: {
      slug: unique('media-event'),
      title: 'Media Test Event',
      shortDescription: 'Short description',
      fullDescription: 'Full description',
      category: 'culture',
      location: 'Tashkent',
      startsAt: new Date('2099-01-01T10:00:00.000Z'),
      endsAt: new Date('2099-01-01T12:00:00.000Z'),
      status: options.status ?? 'PUBLISHED',
      tags: [],
      createdById: options.createdById,
    },
  });
  created.events.push(event.id);
  return event;
}

async function createSettings(eventId: string, data: Record<string, unknown> = {}) {
  return prisma.eventMediaSettings.create({
    data: {
      eventId,
      ...data,
    },
  });
}

async function createMedia(input: {
  eventId: string;
  uploaderUserId: string;
  source?: EventMediaSource;
  status?: EventMediaStatus;
  mimeType?: string;
  credit?: string | null;
  approvedAt?: Date | null;
}) {
  const mimeType = input.mimeType ?? 'image/jpeg';
  const asset = await prisma.mediaAsset.create({
    data: {
      ownerUserId: input.uploaderUserId,
      purpose: 'EVENT_MEDIA',
      originalFilename: mimeType.startsWith('video/') ? 'clip.mp4' : 'photo.jpg',
      mimeType,
      sizeBytes: 1024,
      storageDriver: 'local',
      storageKey: unique('media-asset'),
      publicUrl: `https://cdn.example.test/${unique('media')}`,
    },
  });
  created.assets.push(asset.id);

  const status = input.status ?? 'APPROVED';
  const media = await prisma.eventMedia.create({
    data: {
      eventId: input.eventId,
      assetId: asset.id,
      uploaderUserId: input.uploaderUserId,
      source: input.source ?? 'PARTICIPANT',
      status,
      credit: input.credit ?? null,
      approvedByUserId: status === 'APPROVED' ? input.uploaderUserId : null,
      approvedAt: status === 'APPROVED' ? input.approvedAt ?? new Date('2099-01-01T11:00:00.000Z') : null,
      rejectedByUserId: status === 'REJECTED' ? input.uploaderUserId : null,
      rejectedAt: status === 'REJECTED' ? new Date('2099-01-01T11:00:00.000Z') : null,
      deletedAt: status === 'DELETED' ? new Date('2099-01-01T11:00:00.000Z') : null,
    },
  });
  created.media.push(media.id);
  return media;
}

async function addParticipant(eventId: string, userId: string, status: 'ACTIVE' | 'APPROVED' | 'RESERVE' = 'ACTIVE') {
  return prisma.eventMember.create({
    data: {
      eventId,
      userId,
      role: 'PARTICIPANT',
      status,
    },
  });
}

async function addEventAdmin(eventId: string, userId: string) {
  await prisma.eventMember.create({
    data: {
      eventId,
      userId,
      role: 'EVENT_ADMIN',
      status: 'ACTIVE',
    },
  });
  await prisma.eventStaffAccess.create({
    data: {
      eventId,
      userId,
      status: 'ACTIVE',
      roles: ['ADMIN'],
      permissions: ['event.manageMedia'],
      isOwner: false,
    },
  });
}

describe('event media public privacy', () => {
  it('GET /api/events/:eventId/media hides credit when showCredit is false', async () => {
    const uploader = await createUser();
    const event = await createEvent();
    await createSettings(event.id, { showCredit: false });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, credit: 'Secret credit' });

    const res = await request(app).get(`/api/events/${event.id}/media`);

    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(1);
    expect(res.body.media[0].credit).toBeNull();
  });

  it('GET /api/events/:eventId/media shows credit when showCredit is true', async () => {
    const uploader = await createUser();
    const event = await createEvent();
    await createSettings(event.id, { showCredit: true });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, credit: 'Author Name' });

    const res = await request(app).get(`/api/events/${event.id}/media`);

    expect(res.status).toBe(200);
    expect(res.body.media).toHaveLength(1);
    expect(res.body.media[0].credit).toBe('Author Name');
  });

  it('GET /api/events/media/highlights respects showCredit=false', async () => {
    const uploader = await createUser();
    const event = await createEvent({ status: 'PUBLISHED' });
    await createSettings(event.id, { enabled: true, showCredit: false });
    const media = await createMedia({
      eventId: event.id,
      uploaderUserId: uploader.id,
      credit: 'Hidden highlight credit',
      approvedAt: new Date('2099-12-01T10:00:00.000Z'),
    });

    const res = await request(app).get('/api/events/media/highlights?limit=24');
    const item = res.body.media.find((entry: any) => entry.id === media.id);

    expect(res.status).toBe(200);
    expect(item).toBeTruthy();
    expect(item.credit).toBeNull();
  });

  it('GET /api/events/media/highlights respects showUploaderName=false', async () => {
    const uploader = await createUser();
    const event = await createEvent({ status: 'PUBLISHED' });
    await createSettings(event.id, { enabled: true, showUploaderName: false });
    const media = await createMedia({
      eventId: event.id,
      uploaderUserId: uploader.id,
      approvedAt: new Date('2099-12-02T10:00:00.000Z'),
    });

    const res = await request(app).get('/api/events/media/highlights?limit=24');
    const item = res.body.media.find((entry: any) => entry.id === media.id);

    expect(res.status).toBe(200);
    expect(item).toBeTruthy();
    expect(item.uploader).toBeNull();
  });
});

describe('participant media upload business errors', () => {
  it('POST /api/me/events/:eventId/media returns EVENT_MEDIA_BANK_DISABLED when media bank is disabled', async () => {
    const user = await createUser();
    const event = await createEvent();
    await createSettings(event.id, { enabled: false, participantUploadEnabled: true });
    await addParticipant(event.id, user.id);

    const res = await request(app)
      .post(`/api/me/events/${event.id}/media`)
      .set('Authorization', authHeader(user))
      .attach('file', Buffer.from('photo'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_BANK_DISABLED');
  });

  it('POST /api/me/events/:eventId/media returns EVENT_MEDIA_UPLOAD_DISABLED when participant upload is disabled', async () => {
    const user = await createUser();
    const event = await createEvent();
    await createSettings(event.id, { enabled: true, participantUploadEnabled: false });
    await addParticipant(event.id, user.id);

    const res = await request(app)
      .post(`/api/me/events/${event.id}/media`)
      .set('Authorization', authHeader(user))
      .attach('file', Buffer.from('photo'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_UPLOAD_DISABLED');
  });

  it('POST /api/me/events/:eventId/media returns EVENT_MEDIA_UPLOAD_FORBIDDEN for a non-participant', async () => {
    const user = await createUser();
    const event = await createEvent();
    await createSettings(event.id, { enabled: true, participantUploadEnabled: true });

    const res = await request(app)
      .post(`/api/me/events/${event.id}/media`)
      .set('Authorization', authHeader(user))
      .attach('file', Buffer.from('photo'), { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EVENT_MEDIA_UPLOAD_FORBIDDEN');
  });
});

describe('admin media settings allowedTypes validation', () => {
  it('rejects empty allowedTypes', async () => {
    const admin = await createUser('PLATFORM_ADMIN');
    const event = await createEvent({ createdById: admin.id });
    await createSettings(event.id);

    const res = await request(app)
      .patch(`/api/admin/events/${event.id}/media/settings`)
      .set('Authorization', authHeader(admin))
      .send({ allowedTypes: [] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_MEDIA_ALLOWED_TYPES_REQUIRED');
  });

  it('accepts image-only allowedTypes', async () => {
    const admin = await createUser('PLATFORM_ADMIN');
    const event = await createEvent({ createdById: admin.id });
    await createSettings(event.id);

    const res = await request(app)
      .patch(`/api/admin/events/${event.id}/media/settings`)
      .set('Authorization', authHeader(admin))
      .send({ allowedTypes: ['image'] });

    expect(res.status).toBe(200);
    expect(res.body.settings.allowedTypes).toEqual(['image']);
  });

  it('accepts video-only allowedTypes', async () => {
    const admin = await createUser('PLATFORM_ADMIN');
    const event = await createEvent({ createdById: admin.id });
    await createSettings(event.id);

    const res = await request(app)
      .patch(`/api/admin/events/${event.id}/media/settings`)
      .set('Authorization', authHeader(admin))
      .send({ allowedTypes: ['video'] });

    expect(res.status).toBe(200);
    expect(res.body.settings.allowedTypes).toEqual(['video']);
  });

  it('ignores invalid allowedTypes values but rejects an empty normalized list', async () => {
    const admin = await createUser('PLATFORM_ADMIN');
    const event = await createEvent({ createdById: admin.id });
    await createSettings(event.id);

    const res = await request(app)
      .patch(`/api/admin/events/${event.id}/media/settings`)
      .set('Authorization', authHeader(admin))
      .send({ allowedTypes: ['pdf', 'doc'] });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_MEDIA_ALLOWED_TYPES_REQUIRED');
  });
});

describe('admin event media summary', () => {
  it('counts only the requested event and ignores list filters', async () => {
    const platformAdmin = await createUser('PLATFORM_ADMIN');
    const uploader = await createUser();
    const event = await createEvent({ createdById: platformAdmin.id });
    const otherEvent = await createEvent({ createdById: platformAdmin.id });
    await createSettings(event.id);
    await createSettings(otherEvent.id);

    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, status: 'PENDING', source: 'PARTICIPANT', mimeType: 'image/jpeg' });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, status: 'PENDING', source: 'PARTICIPANT', mimeType: 'video/mp4' });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, status: 'APPROVED', source: 'PARTICIPANT', mimeType: 'image/png' });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, status: 'APPROVED', source: 'ADMIN', mimeType: 'video/webm' });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, status: 'APPROVED', source: 'ADMIN', mimeType: 'image/webp' });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, status: 'REJECTED', source: 'PARTICIPANT', mimeType: 'video/mp4' });
    await createMedia({ eventId: event.id, uploaderUserId: uploader.id, status: 'DELETED', source: 'ADMIN', mimeType: 'image/gif' });
    await createMedia({ eventId: otherEvent.id, uploaderUserId: uploader.id, status: 'APPROVED', source: 'ADMIN', mimeType: 'image/jpeg' });

    const res = await request(app)
      .get(`/api/admin/events/${event.id}/media/summary?status=PENDING&type=image`)
      .set('Authorization', authHeader(platformAdmin));

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      pending: 2,
      approved: 3,
      rejected: 1,
      deleted: 1,
      participant: 4,
      admin: 3,
      images: 4,
      videos: 3,
    });
  });

  it('enforces summary permissions for regular, event-admin, and platform-admin users', async () => {
    const regularUser = await createUser();
    const eventAdmin = await createUser();
    const platformAdmin = await createUser('PLATFORM_ADMIN');
    const event = await createEvent({ createdById: platformAdmin.id });
    await createSettings(event.id);
    await addEventAdmin(event.id, eventAdmin.id);

    const forbidden = await request(app)
      .get(`/api/admin/events/${event.id}/media/summary`)
      .set('Authorization', authHeader(regularUser));
    const eventAdminRes = await request(app)
      .get(`/api/admin/events/${event.id}/media/summary`)
      .set('Authorization', authHeader(eventAdmin));
    const platformAdminRes = await request(app)
      .get(`/api/admin/events/${event.id}/media/summary`)
      .set('Authorization', authHeader(platformAdmin));

    expect(forbidden.status).toBe(403);
    expect(eventAdminRes.status).toBe(200);
    expect(platformAdminRes.status).toBe(200);
  });
});
