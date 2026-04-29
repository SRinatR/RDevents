import request from 'supertest';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../../app.js';
import { prisma } from '../../db/prisma.js';

const app = createApp();
const createdUserIds: string[] = [];
const createdEventIds: string[] = [];

const pastDeadline = new Date('2020-01-01T00:00:00.000Z');
const futureDeadline = new Date('2099-01-01T00:00:00.000Z');
const futureOpenDate = new Date('2099-06-01T00:00:00.000Z');

async function makeUser(runId: string) {
  const user = await prisma.user.create({
    data: { email: `user-${runId}@test.local`, name: 'Test User', isActive: true, role: 'USER' },
  });
  createdUserIds.push(user.id);
  return user;
}

async function makeEvent(runId: string, overrides: Record<string, unknown> = {}) {
  const event = await prisma.event.create({
    data: {
      title: 'Test Event',
      slug: `test-event-${runId}`,
      shortDescription: 'Test',
      fullDescription: 'Test',
      category: 'OTHER',
      location: 'Online',
      requireAdminApprovalForTeams: false,
      isTeamBased: false,
      status: 'PUBLISHED',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 86400000),
      requiredProfileFields: [],
      requiredEventFields: [],
      registrationEnabled: true,
      ...overrides,
    },
  });
  createdEventIds.push(event.id);
  return event;
}

async function makeParticipant(eventId: string, userId: string) {
  return prisma.eventMember.create({
    data: { eventId, userId, role: 'PARTICIPANT', status: 'ACTIVE', approvedAt: new Date() },
  });
}

describe('Registration gates — deadline', () => {
  let runId: string;
  beforeEach(() => { runId = randomUUID(); });
  afterEach(async () => {
    await prisma.eventTeamInvitation.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventTeamMember.deleteMany({ where: { team: { eventId: { in: createdEventIds } } } });
    await prisma.eventTeam.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
    createdEventIds.length = 0;
  });

  it('register throws 410 when deadline passed', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, { registrationDeadline: pastDeadline });
    const res = await request(app)
      .post(`/api/events/${event.id}/register`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('REGISTRATION_DEADLINE_PASSED');
  });

  it('precheck throws 410 when deadline passed', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, { registrationDeadline: pastDeadline });
    const res = await request(app)
      .post(`/api/events/${event.id}/registration/precheck`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('REGISTRATION_DEADLINE_PASSED');
  });

  it('patch answers throws 410 when deadline passed', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, { registrationDeadline: pastDeadline });
    const res = await request(app)
      .patch(`/api/events/${event.id}/registration-answers`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('REGISTRATION_DEADLINE_PASSED');
  });

  it('register succeeds when deadline is future', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, { registrationDeadline: futureDeadline });
    const res = await request(app)
      .post(`/api/events/${event.id}/register`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(201);
  });
});

describe('Registration gates — not open', () => {
  let runId: string;
  beforeEach(() => { runId = randomUUID(); });
  afterEach(async () => {
    await prisma.eventTeamInvitation.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventTeamMember.deleteMany({ where: { team: { eventId: { in: createdEventIds } } } });
    await prisma.eventTeam.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
    createdEventIds.length = 0;
  });

  it('register throws 400 when registration opens in future', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, { registrationOpensAt: futureOpenDate, registrationDeadline: null });
    const res = await request(app)
      .post(`/api/events/${event.id}/register`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REGISTRATION_NOT_OPEN');
  });

  it('precheck throws 400 when registration opens in future', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, { registrationOpensAt: futureOpenDate, registrationDeadline: null });
    const res = await request(app)
      .post(`/api/events/${event.id}/registration/precheck`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REGISTRATION_NOT_OPEN');
  });
});

describe('Registration gates — disabled', () => {
  let runId: string;
  beforeEach(() => { runId = randomUUID(); });
  afterEach(async () => {
    await prisma.eventTeamInvitation.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventTeamMember.deleteMany({ where: { team: { eventId: { in: createdEventIds } } } });
    await prisma.eventTeam.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
    createdEventIds.length = 0;
  });

  it('register throws 400 when registration is disabled', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, { registrationEnabled: false });
    const res = await request(app)
      .post(`/api/events/${event.id}/register`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REGISTRATION_DISABLED');
  });
});

describe('Team gates after deadline', () => {
  let runId: string;
  beforeEach(() => { runId = randomUUID(); });
  afterEach(async () => {
    await prisma.eventTeamInvitation.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventTeamMember.deleteMany({ where: { team: { eventId: { in: createdEventIds } } } });
    await prisma.eventTeam.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
    createdEventIds.length = 0;
  });

  it('createTeam throws 410 when deadline passed', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, {
      isTeamBased: true,
      requireAdminApprovalForTeams: false,
      registrationDeadline: pastDeadline,
    });
    await makeParticipant(event.id, user.id);
    const res = await request(app)
      .post(`/api/events/${event.id}/teams`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({ name: 'My Team' });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('REGISTRATION_DEADLINE_PASSED');
  });

  it('joinTeam throws 410 when deadline passed', async () => {
    const captain = await makeUser(runId);
    const joiner = await makeUser(runId);
    const event = await makeEvent(runId, {
      isTeamBased: true,
      requireAdminApprovalForTeams: false,
      teamJoinMode: 'OPEN',
      registrationDeadline: futureDeadline,
    });
    await makeParticipant(event.id, captain.id);
    await makeParticipant(event.id, joiner.id);
    const team = await prisma.eventTeam.create({
      data: { eventId: event.id, name: 'Captain Team', slug: `cap-team-${runId}`, joinCode: 'ABC123', captainUserId: captain.id, status: 'ACTIVE', maxSize: 5 },
    });
    await prisma.eventTeamMember.create({ data: { teamId: team.id, userId: captain.id, role: 'CAPTAIN', status: 'ACTIVE', approvedAt: new Date() } });
    const res = await request(app)
      .post(`/api/events/${event.id}/teams/${team.id}/join`)
      .set('Authorization', `Bearer test-token-${joiner.id}`)
      .send({});
    expect(res.status).toBe(201);
    await prisma.eventTeamMember.deleteMany({ where: { teamId: team.id } });
    await prisma.eventTeam.delete({ where: { id: team.id } });
  });

  it('createTeam throws 410 after deadline even when deadline is future in seed but now passed', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, {
      isTeamBased: true,
      requireAdminApprovalForTeams: false,
      registrationDeadline: pastDeadline,
    });
    await makeParticipant(event.id, user.id);
    const res = await request(app)
      .post(`/api/events/${event.id}/teams`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({ name: 'Late Team' });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('REGISTRATION_DEADLINE_PASSED');
  });
});

describe('Gate priority order', () => {
  let runId: string;
  beforeEach(() => { runId = randomUUID(); });
  afterEach(async () => {
    await prisma.eventTeamInvitation.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventTeamMember.deleteMany({ where: { team: { eventId: { in: createdEventIds } } } });
    await prisma.eventTeam.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.eventMember.deleteMany({ where: { eventId: { in: createdEventIds } } });
    await prisma.event.deleteMany({ where: { id: { in: createdEventIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds.length = 0;
    createdEventIds.length = 0;
  });

  it('EVENT_NOT_AVAILABLE checked before REGISTRATION_DISABLED', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, {
      status: 'DRAFT',
      registrationEnabled: false,
      registrationDeadline: pastDeadline,
    });
    const res = await request(app)
      .post(`/api/events/${event.id}/register`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EVENT_NOT_AVAILABLE');
  });

  it('REGISTRATION_DISABLED checked before REGISTRATION_NOT_OPEN', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, {
      status: 'PUBLISHED',
      registrationEnabled: false,
      registrationOpensAt: futureOpenDate,
      registrationDeadline: pastDeadline,
    });
    const res = await request(app)
      .post(`/api/events/${event.id}/register`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REGISTRATION_DISABLED');
  });

  it('REGISTRATION_NOT_OPEN checked before REGISTRATION_DEADLINE_PASSED', async () => {
    const user = await makeUser(runId);
    const event = await makeEvent(runId, {
      status: 'PUBLISHED',
      registrationEnabled: true,
      registrationOpensAt: futureOpenDate,
      registrationDeadline: pastDeadline,
    });
    const res = await request(app)
      .post(`/api/events/${event.id}/register`)
      .set('Authorization', `Bearer test-token-${user.id}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REGISTRATION_NOT_OPEN');
  });
});