import { describe, expect, it, beforeEach } from 'vitest';
import {
  adminAddTeamMember,
  adminRemoveTeamMember,
  adminReplaceTeamMember,
  adminReplaceTeamRoster,
  adminTransferTeamCaptain,
  adminUpdateTeamDetails,
} from './team-override.service.js';
import { prisma } from '../../db/prisma.js';

describe('admin team override service', () => {
  let eventAdminId: string;
  let testEventId: string;
  let testTeamId: string;
  let captainId: string;
  let member1Id: string;
  let member2Id: string;
  let externalUserId: string;

  beforeEach(async () => {
    await prisma.eventTeamMember.deleteMany({ where: {} });
    await prisma.eventMember.deleteMany({ where: {} });
    await prisma.eventTeam.deleteMany({ where: {} });
    await prisma.event.deleteMany({ where: {} });
    await prisma.user.deleteMany({ where: {} });

    const eventAdmin = await prisma.user.create({
      data: { email: 'admin@test.com', name: 'Admin', isActive: true, role: 'USER' },
    });
    eventAdminId = eventAdmin.id;

    const testEvent = await prisma.event.create({
      data: {
        title: 'Test Event',
        slug: 'test-event-' + Date.now(),
        shortDescription: 'Test',
        fullDescription: 'Test',
        category: 'OTHER',
        location: 'Online',
        requireAdminApprovalForTeams: true,
        status: 'PUBLISHED',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 86400000),
      },
    });
    testEventId = testEvent.id;

    await prisma.eventMember.create({
      data: {
        eventId: testEvent.id,
        userId: eventAdmin.id,
        role: 'EVENT_ADMIN',
        status: 'ACTIVE',
      },
    });

    const captain = await prisma.user.create({
      data: { email: 'captain@test.com', name: 'Captain', isActive: true, role: 'USER' },
    });
    captainId = captain.id;

    const member1 = await prisma.user.create({
      data: { email: 'member1@test.com', name: 'Member 1', isActive: true, role: 'USER' },
    });
    member1Id = member1.id;

    const member2 = await prisma.user.create({
      data: { email: 'member2@test.com', name: 'Member 2', isActive: true, role: 'USER' },
    });
    member2Id = member2.id;

    const externalUser = await prisma.user.create({
      data: { email: 'external@test.com', name: 'External', isActive: true, role: 'USER' },
    });
    externalUserId = externalUser.id;

    await prisma.eventMember.createMany({
      data: [
        { eventId: testEventId, userId: captainId, role: 'PARTICIPANT', status: 'ACTIVE' },
        { eventId: testEventId, userId: member1Id, role: 'PARTICIPANT', status: 'ACTIVE' },
        { eventId: testEventId, userId: member2Id, role: 'PARTICIPANT', status: 'ACTIVE' },
        { eventId: testEventId, userId: externalUserId, role: 'PARTICIPANT', status: 'ACTIVE' },
      ],
    });

    const testTeam = await prisma.eventTeam.create({
      data: {
        eventId: testEventId,
        name: 'Test Team',
        slug: 'test-team-' + Date.now(),
        status: 'APPROVED',
        maxSize: 5,
        captainUserId: captainId,
      },
    });
    testTeamId = testTeam.id;

    await prisma.eventTeamMember.createMany({
      data: [
        { teamId: testTeamId, userId: captainId, role: 'CAPTAIN', status: 'ACTIVE' },
        { teamId: testTeamId, userId: member1Id, role: 'MEMBER', status: 'ACTIVE' },
        { teamId: testTeamId, userId: member2Id, role: 'MEMBER', status: 'ACTIVE' },
      ],
    });
  });

  it('admin can update team details', async () => {
    const result = await adminUpdateTeamDetails({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      name: 'Updated Team Name',
      reason: 'Test update',
    });

    expect(result.name).toBe('Updated Team Name');
  });

  it('admin can add member to team', async () => {
    const result = await adminAddTeamMember({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      userId: externalUserId,
      reason: 'Adding new member',
    });

    const member = result.members.find((m: any) => m.userId === externalUserId);
    expect(member).toBeDefined();
    expect(member.status).toBe('ACTIVE');
  });

  it('add member auto-creates EventMember PARTICIPANT if needed', async () => {
    await prisma.eventMember.deleteMany({ where: { userId: externalUserId } });

    await adminAddTeamMember({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      userId: externalUserId,
      reason: 'Test',
    });

    const membership = await prisma.eventMember.findUnique({
      where: {
        eventId_userId_role: {
          eventId: testEventId,
          userId: externalUserId,
          role: 'PARTICIPANT',
        },
      },
    });

    expect(membership).toBeDefined();
    expect(membership.status).toBe('ACTIVE');
  });

  it('cannot add disabled user', async () => {
    const disabledUser = await prisma.user.create({
      data: { email: 'disabled@test.com', name: 'Disabled', isActive: false, role: 'USER' },
    });

    await expect(
      adminAddTeamMember({
        actor: { id: eventAdminId } as any,
        teamId: testTeamId,
        userId: disabledUser.id,
        reason: 'Test',
      })
    ).rejects.toThrow('USER_DISABLED');
  });

  it('cannot add user from another team without forceMoveFromOtherTeam', async () => {
    const otherTeam = await prisma.eventTeam.create({
      data: {
        eventId: testEventId,
        name: 'Other Team',
        slug: 'other-team-1-' + Date.now(),
        status: 'APPROVED',
        maxSize: 5,
        captainUserId: externalUserId,
      },
    });

    await prisma.eventTeamMember.create({
      data: {
        teamId: otherTeam.id,
        userId: externalUserId,
        role: 'CAPTAIN',
        status: 'ACTIVE',
      },
    });

    await expect(
      adminAddTeamMember({
        actor: { id: eventAdminId } as any,
        teamId: testTeamId,
        userId: externalUserId,
        reason: 'Test',
      })
    ).rejects.toThrow('USER_ALREADY_IN_OTHER_TEAM');
  });

  it('can move user from another team with forceMoveFromOtherTeam', async () => {
    const otherTeam = await prisma.eventTeam.create({
      data: {
        eventId: testEventId,
        name: 'Other Team',
        slug: 'other-team-2-' + Date.now(),
        status: 'APPROVED',
        maxSize: 5,
        captainUserId: externalUserId,
      },
    });

    await prisma.eventTeamMember.create({
      data: {
        teamId: otherTeam.id,
        userId: externalUserId,
        role: 'CAPTAIN',
        status: 'ACTIVE',
      },
    });

    const result = await adminAddTeamMember({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      userId: externalUserId,
      forceMoveFromOtherTeam: true,
      reason: 'Force move test',
    });

    const member = result.members.find((m: any) => m.userId === externalUserId);
    expect(member).toBeDefined();
    expect(member.status).toBe('ACTIVE');

    const oldMember = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId: otherTeam.id, userId: externalUserId } },
    });
    expect(oldMember.status).toBe('REMOVED');
  });

  it('cannot exceed maxSize without allowOverCapacity', async () => {
    await prisma.eventTeam.update({
      where: { id: testTeamId },
      data: { maxSize: 3 },
    });

    const newUser = await prisma.user.create({
      data: { email: 'extra@test.com', name: 'Extra', isActive: true, role: 'USER' },
    });

    await expect(
      adminAddTeamMember({
        actor: { id: eventAdminId } as any,
        teamId: testTeamId,
        userId: newUser.id,
        reason: 'Test',
      })
    ).rejects.toThrow('TEAM_FULL');
  });

  it('can exceed maxSize with allowOverCapacity', async () => {
    await prisma.eventTeam.update({
      where: { id: testTeamId },
      data: { maxSize: 3 },
    });

    const newUser = await prisma.user.create({
      data: { email: 'extra@test.com', name: 'Extra', isActive: true, role: 'USER' },
    });

    const result = await adminAddTeamMember({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      userId: newUser.id,
      allowOverCapacity: true,
      reason: 'Test',
    });

    const member = result.members.find((m: any) => m.userId === newUser.id);
    expect(member).toBeDefined();
  });

  it('admin can replace member', async () => {
    const newUser = await prisma.user.create({
      data: { email: 'newmember@test.com', name: 'New Member', isActive: true, role: 'USER' },
    });

    const result = await adminReplaceTeamMember({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      oldUserId: member1Id,
      newUserId: newUser.id,
      reason: 'Replacement test',
    });

    const newMember = result.members.find((m: any) => m.userId === newUser.id);
    expect(newMember).toBeDefined();
    expect(newMember.status).toBe('ACTIVE');

    const oldMember = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId: testTeamId, userId: member1Id } },
    });
    expect(oldMember.status).toBe('REMOVED');
  });

  it('admin cannot remove captain via remove endpoint', async () => {
    await expect(
      adminRemoveTeamMember({
        actor: { id: eventAdminId } as any,
        teamId: testTeamId,
        userId: captainId,
        reason: 'Test',
      })
    ).rejects.toThrow('CANNOT_REMOVE_CAPTAIN');
  });

  it('admin can transfer captain', async () => {
    const result = await adminTransferTeamCaptain({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      userId: member1Id,
      reason: 'Captain transfer test',
    });

    const newCaptain = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId: testTeamId, userId: member1Id } },
    });
    expect(newCaptain.role).toBe('CAPTAIN');

    const oldCaptain = await prisma.eventTeamMember.findUnique({
      where: { teamId_userId: { teamId: testTeamId, userId: captainId } },
    });
    expect(oldCaptain.role).toBe('MEMBER');
  });

  it('admin can replace full roster', async () => {
    const newUser1 = await prisma.user.create({
      data: { email: 'newuser1@test.com', name: 'New User 1', isActive: true, role: 'USER' },
    });
    const newUser2 = await prisma.user.create({
      data: { email: 'newuser2@test.com', name: 'New User 2', isActive: true, role: 'USER' },
    });

    await prisma.eventMember.createMany({
      data: [
        { eventId: testEventId, userId: newUser1.id, role: 'PARTICIPANT', status: 'ACTIVE' },
        { eventId: testEventId, userId: newUser2.id, role: 'PARTICIPANT', status: 'ACTIVE' },
      ],
    });

    const result = await adminReplaceTeamRoster({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      memberUserIds: [newUser1.id, newUser2.id],
      captainUserId: newUser1.id,
      reason: 'Full roster replacement test',
    });

    expect(result.members.length).toBe(2);
    expect(result.members.find((m: any) => m.userId === newUser1.id).role).toBe('CAPTAIN');
    expect(result.members.find((m: any) => m.userId === newUser2.id).role).toBe('MEMBER');
  });

  it('every override cancels open change requests', async () => {
    await prisma.eventTeamChangeRequest.create({
      data: {
        eventId: testEventId,
        teamId: testTeamId,
        requestedByUserId: captainId,
        type: 'DETAILS_UPDATE',
        status: 'PENDING',
      },
    });

    await adminUpdateTeamDetails({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      name: 'Updated Name',
      reason: 'Test',
    });

    const openRequests = await prisma.eventTeamChangeRequest.findMany({
      where: { teamId: testTeamId, status: 'PENDING' },
    });

    expect(openRequests.length).toBe(0);

    const cancelledRequests = await prisma.eventTeamChangeRequest.findMany({
      where: { teamId: testTeamId, status: 'CANCELLED' },
    });

    expect(cancelledRequests.length).toBe(1);
  });

  it('every override writes EventTeamHistory', async () => {
    await adminAddTeamMember({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      userId: externalUserId,
      reason: 'History test',
    });

    const history = await prisma.eventTeamHistory.findMany({
      where: { teamId: testTeamId },
      orderBy: { createdAt: 'desc' },
    });

    expect(history.length).toBeGreaterThan(0);
    const lastEntry = history[0];
    expect(lastEntry.action).toBe('ADMIN_MEMBER_ADDED');
    expect(lastEntry.actorUserId).toBe(eventAdminId);
    expect(lastEntry.targetUserId).toBe(externalUserId);
    expect(lastEntry.beforeJson).toBeDefined();
    expect(lastEntry.afterJson).toBeDefined();
    expect(lastEntry.reason).toBe('History test');
  });

  it('forceMoveFromOtherTeam writes ADMIN_MEMBER_REMOVED history on source team', async () => {
    const otherTeam = await prisma.eventTeam.create({
      data: {
        eventId: testEventId,
        name: 'Other Team',
        slug: 'other-team-3-' + Date.now(),
        status: 'APPROVED',
        maxSize: 5,
        captainUserId: externalUserId,
      },
    });

    await prisma.eventTeamMember.create({
      data: {
        teamId: otherTeam.id,
        userId: externalUserId,
        role: 'CAPTAIN',
        status: 'ACTIVE',
      },
    });

    await adminAddTeamMember({
      actor: { id: eventAdminId } as any,
      teamId: testTeamId,
      userId: externalUserId,
      forceMoveFromOtherTeam: true,
      reason: 'Force move test',
    });

    const sourceHistory = await prisma.eventTeamHistory.findMany({
      where: { teamId: otherTeam.id, action: 'ADMIN_MEMBER_REMOVED' },
    });

    expect(sourceHistory.length).toBe(1);
    expect(sourceHistory[0].metaJson).toMatchObject({
      reason: 'forceMoveFromOtherTeam',
      movedToTeamId: testTeamId,
    });
  });
});
