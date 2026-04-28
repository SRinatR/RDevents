import { prisma } from '../../db/prisma.js';
import { buildDefaultRecipientVariables } from '../email/email-renderer.service.js';
import { normalizeEmail } from '@event-platform/shared';

export type ResolveAudienceInput = {
  broadcastId?: string | null;
  broadcastType: string;
  audienceKind?: string;
  audienceSource: string;
  audienceFilterJson?: any;
  savedAudienceId?: string | null;
  includeSkipped?: boolean;
  limit?: number;
  offset?: number;
  resultLimit?: number;
};

export type AudiencePreviewItem = {
  userId?: string;
  email?: string;
  normalizedEmail?: string;
  name?: string;
  eligible: boolean;
  status: string;
  skipReason?: string;
  consentSnapshot?: unknown;
  variables?: Record<string, string>;
  audienceReason?: unknown;
};

export type AudiencePreviewResult = {
  totalMatched: number;
  totalEligible: number;
  totalSkipped: number;
  skippedByReason: Record<string, number>;
  items: AudiencePreviewItem[];
};

type CandidateUser = {
  id?: string;
  email: string | null;
  name: string | null;
  city?: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  extendedProfile?: { consentMailing?: boolean | null; regionId?: string | null; regionText?: string | null } | null;
  communicationConsents?: Array<{ channel: string; topic: string; status: string; optedInAt?: Date | null; optedOutAt?: Date | null; lastChangedAt?: Date | null }>;
  audienceReason?: unknown;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toDbEnum(value: unknown, fallback: string) {
  return String(value ?? fallback).trim().toUpperCase();
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return value.split(',').map(item => item.trim()).filter(Boolean);
  return [];
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function extractEmailAddress(value: string) {
  const trimmed = value.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  return (angleMatch?.[1] ?? trimmed).trim();
}

function extractManualSelection(filter: any) {
  const manual = filter?.manualSelection ?? {};
  const emails = uniqueStrings(
    [...toArray(filter?.emails), ...toArray(manual?.emails)]
      .map(extractEmailAddress)
      .filter((value) => EMAIL_REGEX.test(value)),
  );
  const userIds = uniqueStrings(
    [...toArray(filter?.userIds), ...toArray(manual?.userIds)]
      .map((value) => value.replace(/^(user|id):/i, '').trim())
      .filter(Boolean),
  );

  return {
    eventId: filter?.eventId ? String(filter.eventId) : null,
    emails,
    userIds,
  };
}

function isSuppressionEnforced(type: string) {
  return !['SYSTEM_NOTIFICATION', 'TRANSACTIONAL', 'ADMIN_TEST'].includes(type);
}

function requiresVerifiedEmail(type: string, audienceKind: string, filter: any) {
  if (filter?.emailVerified === true) return true;
  if (audienceKind === 'VERIFIED_USERS' || audienceKind === 'MAILING_CONSENT') return true;
  return ['MARKETING', 'EVENT_ANNOUNCEMENT', 'EVENT_REMINDER'].includes(type);
}

function requiredConsentTopics(type: string) {
  switch (type) {
    case 'MARKETING':
      return ['MARKETING'];
    case 'EVENT_ANNOUNCEMENT':
      return ['EVENT_ANNOUNCEMENTS', 'MARKETING'];
    case 'EVENT_REMINDER':
      return ['EVENT_REMINDERS', 'MARKETING'];
    default:
      return [];
  }
}

function consentSnapshot(user: CandidateUser) {
  return {
    legacyConsentMailing: Boolean(user.extendedProfile?.consentMailing),
    consents: (user.communicationConsents ?? []).map(consent => ({
      channel: consent.channel,
      topic: consent.topic,
      status: consent.status,
      optedInAt: consent.optedInAt?.toISOString?.() ?? null,
      optedOutAt: consent.optedOutAt?.toISOString?.() ?? null,
      lastChangedAt: consent.lastChangedAt?.toISOString?.() ?? null,
    })),
  };
}

function consentDecision(user: CandidateUser, type: string) {
  const topics = requiredConsentTopics(type);
  if (topics.length === 0) return { allowed: true, optedOut: false, topics };

  const emailConsents = (user.communicationConsents ?? []).filter(consent => consent.channel === 'EMAIL');
  const optedOut = emailConsents.some(consent => topics.includes(consent.topic) && consent.status === 'OPTED_OUT');
  if (optedOut) return { allowed: false, optedOut: true, topics };

  const optedIn = emailConsents.some(consent => topics.includes(consent.topic) && consent.status === 'OPTED_IN');
  if (optedIn) return { allowed: true, optedOut: false, topics };

  const legacyMarketing = topics.includes('MARKETING') && user.extendedProfile?.consentMailing === true;
  return { allowed: Boolean(legacyMarketing), optedOut: false, topics };
}

function applyProfileFilters(where: any, filter: any) {
  if (!filter) return where;
  const city = toArray(filter.city);
  if (city.length) where.city = { in: city };
  if (filter.emailVerified === true) where.emailVerifiedAt = { not: null };
  return where;
}

function userSelect() {
  return {
    id: true,
    email: true,
    name: true,
    city: true,
    isActive: true,
    emailVerifiedAt: true,
    extendedProfile: { select: { consentMailing: true, regionId: true, regionText: true } },
    communicationConsents: {
      where: { channel: 'EMAIL' as any },
      select: {
        channel: true,
        topic: true,
        status: true,
        optedInAt: true,
        optedOutAt: true,
        lastChangedAt: true,
      },
    },
  };
}

async function resolveStaticCandidates(audienceKind: string, filter: any, limit: number): Promise<CandidateUser[]> {
  const where: any = {};

  if (audienceKind === 'PLATFORM_ADMINS') {
    where.role = { in: ['PLATFORM_ADMIN', 'SUPER_ADMIN'] };
  }
  if (audienceKind === 'VERIFIED_USERS') {
    where.emailVerifiedAt = { not: null };
  }
  if (filter?.isActive === true) {
    where.isActive = true;
  }
  applyProfileFilters(where, filter);

  const users = await prisma.user.findMany({
    where,
    select: userSelect() as any,
    orderBy: { registeredAt: 'desc' },
    take: limit,
  });

  return users.map(user => ({
    ...(user as any),
    audienceReason: { matchedBy: audienceKind.toLowerCase() },
  }));
}

async function activeTeamUserIds(eventId: string, filter: any) {
  const teamStatuses = toArray(filter?.teamStatuses);
  const memberStatuses = toArray(filter?.teamMemberStatuses);
  const rows = await prisma.eventTeamMember.findMany({
    where: {
      team: {
        eventId,
        ...(teamStatuses.length ? { status: { in: teamStatuses as any[] } } : { status: { in: ['ACTIVE', 'PENDING', 'SUBMITTED', 'CHANGES_PENDING'] as any[] } }),
      },
      ...(memberStatuses.length ? { status: { in: memberStatuses as any[] } } : { status: { in: ['ACTIVE', 'PENDING'] as any[] } }),
    },
    select: { userId: true },
  });
  return new Set(rows.map(row => row.userId));
}

async function resolveEventParticipantCandidates(filter: any, limit: number): Promise<CandidateUser[]> {
  const eventId = filter?.eventId ? String(filter.eventId) : null;
  if (!eventId) return [];

  const memberRoles = toArray(filter.memberRoles).length ? toArray(filter.memberRoles) : ['PARTICIPANT'];
  const memberStatuses = toArray(filter.memberStatuses).length ? toArray(filter.memberStatuses) : ['ACTIVE'];
  const teamMembership = String(filter.teamMembership ?? 'ANY').toUpperCase();
  const teamUserIds = ['WITHOUT_TEAM', 'WITH_TEAM'].includes(teamMembership) ? await activeTeamUserIds(eventId, filter) : null;

  const rows = await prisma.eventMember.findMany({
    where: {
      eventId,
      role: { in: memberRoles as any[] },
      status: { in: memberStatuses as any[] },
      user: applyProfileFilters({} as any, filter),
    },
    include: { user: { select: userSelect() as any } },
    orderBy: { assignedAt: 'desc' },
    take: limit,
  });

  return rows
    .filter((row: any) => {
      if (!teamUserIds) return true;
      const hasTeam = teamUserIds.has(row.userId);
      return teamMembership === 'WITH_TEAM' ? hasTeam : !hasTeam;
    })
    .map((row: any) => ({
      ...row.user,
      audienceReason: {
        matchedBy: 'eventMember',
        eventId,
        memberRole: row.role,
        memberStatus: row.status,
        teamMembership,
      },
    }));
}

async function resolveEventTeamCandidates(filter: any, limit: number): Promise<CandidateUser[]> {
  const eventId = filter?.eventId ? String(filter.eventId) : null;
  if (!eventId) return [];

  if (String(filter.teamMembership ?? '').toUpperCase() === 'WITHOUT_TEAM') {
    return resolveEventParticipantCandidates({ ...filter, teamMembership: 'WITHOUT_TEAM' }, limit);
  }

  const teamMemberStatuses = toArray(filter.teamMemberStatuses).length ? toArray(filter.teamMemberStatuses) : ['ACTIVE'];
  const teamStatuses = toArray(filter.teamStatuses).length ? toArray(filter.teamStatuses) : ['ACTIVE'];
  const teamRoles = toArray(filter.teamRoles);

  const rows = await prisma.eventTeamMember.findMany({
    where: {
      status: { in: teamMemberStatuses as any[] },
      ...(teamRoles.length ? { role: { in: teamRoles as any[] } } : {}),
      team: {
        eventId,
        status: { in: teamStatuses as any[] },
        ...(filter.teamId ? { id: String(filter.teamId) } : {}),
      },
      user: applyProfileFilters({} as any, filter),
    },
    include: {
      user: { select: userSelect() as any },
      team: { select: { id: true, name: true, status: true } },
    },
    orderBy: { joinedAt: 'desc' },
    take: limit,
  });

  return rows.map((row: any) => ({
    ...row.user,
    audienceReason: {
      matchedBy: 'eventTeamMember',
      eventId,
      teamId: row.teamId,
      teamName: row.team?.name,
      teamStatus: row.team?.status,
      teamMemberStatus: row.status,
      teamRole: row.role,
    },
  }));
}

async function manualSelectionScopedUserIds(eventId: string) {
  const [eventMembers, teamMembers] = await Promise.all([
    prisma.eventMember.findMany({
      where: { eventId },
      select: { userId: true },
    }),
    prisma.eventTeamMember.findMany({
      where: { team: { eventId } },
      select: { userId: true },
    }),
  ]);

  return new Set([
    ...eventMembers.map((row) => row.userId),
    ...teamMembers.map((row) => row.userId),
  ]);
}

async function resolveManualSelectionCandidates(filter: any, limit: number): Promise<CandidateUser[]> {
  const selection = extractManualSelection(filter);
  if (selection.emails.length === 0 && selection.userIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(selection.userIds.length ? [{ id: { in: selection.userIds } }] : []),
        ...(selection.emails.length ? [{ email: { in: selection.emails } }] : []),
      ],
    },
    select: userSelect() as any,
    take: Math.min(Math.max(limit, selection.emails.length + selection.userIds.length), 10000),
  });

  const scopedUserIds = selection.eventId
    ? await manualSelectionScopedUserIds(selection.eventId)
    : null;
  const eligibleUsers = scopedUserIds
    ? users.filter((user: any) => scopedUserIds.has(user.id))
    : users;

  const usersById = new Map(eligibleUsers.map((user: any) => [user.id, user]));
  const usersByEmail = new Map(
    eligibleUsers
      .filter((user: any) => user.email)
      .map((user: any) => [normalizeEmail(String(user.email)), user]),
  );
  const orderedCandidates: CandidateUser[] = [];
  const addedKeys = new Set<string>();

  const pushCandidate = (candidate: CandidateUser, key: string) => {
    if (addedKeys.has(key) || orderedCandidates.length >= limit) return;
    addedKeys.add(key);
    orderedCandidates.push(candidate);
  };

  for (const userId of selection.userIds) {
    const user = usersById.get(userId);
    if (!user) continue;
    pushCandidate(
      {
        ...(user as any),
        audienceReason: {
          matchedBy: 'manualSelection',
          via: 'userId',
          value: userId,
          eventId: selection.eventId,
        },
      },
      `user:${user.id}`,
    );
  }

  for (const email of selection.emails) {
    const normalized = normalizeEmail(email);
    const user = usersByEmail.get(normalized);
    if (user) {
      pushCandidate(
        {
          ...(user as any),
          audienceReason: {
            matchedBy: 'manualSelection',
            via: 'email',
            value: email,
            eventId: selection.eventId,
          },
        },
        `user:${user.id}`,
      );
      continue;
    }

    if (selection.eventId) {
      continue;
    }

    pushCandidate(
      {
        email,
        name: null,
        isActive: true,
        emailVerifiedAt: null,
        extendedProfile: null,
        communicationConsents: [],
        audienceReason: {
          matchedBy: 'manualSelection',
          via: 'email',
          value: email,
          eventId: null,
          resolved: 'rawEmail',
        },
      },
      `email:${normalized}`,
    );
  }

  return orderedCandidates;
}

async function resolveCandidates(input: ResolveAudienceInput) {
  const filter = input.audienceFilterJson ?? {};
  const limit = Math.max(1, Math.min(Number(input.limit ?? 5000), 10000));
  const source = toDbEnum(input.audienceSource, 'STATIC_FILTER');
  const audienceKind = toDbEnum(input.audienceKind, 'MAILING_CONSENT');

  if (source === 'EVENT_PARTICIPANTS') {
    return resolveEventParticipantCandidates(filter, limit);
  }
  if (source === 'EVENT_TEAMS') {
    return resolveEventTeamCandidates(filter, limit);
  }
  if (source === 'MANUAL_SELECTION') {
    return resolveManualSelectionCandidates(filter, limit);
  }
  return resolveStaticCandidates(audienceKind, filter, limit);
}

export async function resolveAudience(input: ResolveAudienceInput): Promise<AudiencePreviewResult> {
  const type = toDbEnum(input.broadcastType, 'MARKETING');
  const audienceKind = toDbEnum(input.audienceKind, 'MAILING_CONSENT');
  const filter = input.audienceFilterJson ?? {};
  const candidates = await resolveCandidates(input);
  const normalizedEmails = candidates.map(user => user.email ? normalizeEmail(user.email) : '').filter(Boolean);
  const suppressions = normalizedEmails.length && isSuppressionEnforced(type)
    ? await prisma.emailSuppression.findMany({
        where: { normalizedEmail: { in: normalizedEmails } },
        select: { normalizedEmail: true, reason: true },
      })
    : [];
  const suppressionByEmail = new Map(suppressions.map(row => [row.normalizedEmail, row.reason]));
  const seenEmails = new Set<string>();

  const items = candidates.map((user) => {
    const email = user.email?.trim() ?? '';
    const normalizedEmail = email ? normalizeEmail(email) : '';
    const consent = consentDecision(user, type);
    const consentSnap = consentSnapshot(user);
    const variables = buildDefaultRecipientVariables({
      userId: user.id,
      email,
      name: user.name,
      broadcastId: input.broadcastId ?? null,
      topic: type,
    }) as Record<string, string>;

    let status = 'QUEUED';
    let skipReason: string | undefined;

    if (!email) {
      status = 'SKIPPED_NO_EMAIL';
      skipReason = 'Email is missing.';
    } else if (!EMAIL_REGEX.test(email)) {
      status = 'SKIPPED_INVALID_EMAIL';
      skipReason = 'Email format is invalid.';
    } else if (!user.isActive) {
      status = 'SKIPPED_BLOCKED';
      skipReason = 'User account is inactive.';
    } else if (requiresVerifiedEmail(type, audienceKind, filter) && !user.emailVerifiedAt) {
      status = 'SKIPPED_EMAIL_NOT_VERIFIED';
      skipReason = 'Email is not verified.';
    } else if (suppressionByEmail.has(normalizedEmail)) {
      status = 'SKIPPED_SUPPRESSED';
      skipReason = `Email is suppressed: ${suppressionByEmail.get(normalizedEmail)}`;
    } else if (consent.optedOut) {
      status = 'SKIPPED_UNSUBSCRIBED';
      skipReason = 'User opted out of this communication topic.';
    } else if (!consent.allowed) {
      status = 'SKIPPED_NO_CONSENT';
      skipReason = 'No explicit consent for this communication topic.';
    } else if (seenEmails.has(normalizedEmail)) {
      status = 'SKIPPED_DUPLICATE_EMAIL';
      skipReason = 'Duplicate email in this audience.';
    }

    if (!status.startsWith('SKIPPED') && normalizedEmail) {
      seenEmails.add(normalizedEmail);
    }

    return {
      userId: user.id ?? undefined,
      email: email || undefined,
      normalizedEmail: normalizedEmail || undefined,
      name: user.name ?? undefined,
      eligible: !status.startsWith('SKIPPED'),
      status,
      skipReason,
      consentSnapshot: consentSnap,
      variables,
      audienceReason: user.audienceReason,
    };
  });

  const totalMatched = items.length;
  const totalEligible = items.filter(item => item.eligible).length;
  const totalSkipped = totalMatched - totalEligible;
  const skippedByReason = items.reduce<Record<string, number>>((acc, item) => {
    if (!item.eligible) acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  const offset = Math.max(0, Number(input.offset ?? 0));
  const limit = Math.max(1, Number(input.resultLimit ?? (items.length || 50)));
  const visibleItems = (input.includeSkipped ? items : items.filter(item => item.eligible)).slice(offset, offset + limit);

  return {
    totalMatched,
    totalEligible,
    totalSkipped,
    skippedByReason,
    items: visibleItems,
  };
}

export function extractAudienceEventId(input: { audienceSource?: unknown; audienceFilterJson?: any }) {
  const source = toDbEnum(input.audienceSource, 'STATIC_FILTER');
  const eventId = input.audienceFilterJson?.eventId;
  if (eventId && ['STATIC_FILTER', 'EVENT_PARTICIPANTS', 'EVENT_TEAMS', 'MANUAL_SELECTION'].includes(source)) {
    return String(eventId);
  }
  return null;
}
