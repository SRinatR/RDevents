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
  recipientId: string;
  recipientKind: 'USER' | 'EVENT_MEMBER' | 'TEAM_MEMBER' | 'PREFILL_CONTACT' | 'MANUAL_EMAIL';
  userId?: string | null;
  eventMemberId?: string | null;
  teamMemberId?: string | null;
  prefillContactId?: string | null;
  email?: string;
  normalizedEmail?: string;
  phone?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  role?: string | null;
  status?: string | null;
  eligible: boolean;
  deliveryStatus: string;
  skipReasonCode?: string | null;
  skipReasonText?: string | null;
  skipReason?: string | null;
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
  recipientId?: string;
  recipientKind?: AudiencePreviewItem['recipientKind'];
  teamMemberId?: string | null;
  id: string;
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
        ...(teamStatuses.length ? { status: { in: teamStatuses as any[] } } : { status: { in: ['ACTIVE', 'APPROVED', 'PENDING', 'SUBMITTED', 'CHANGES_PENDING', 'NEEDS_ATTENTION'] as any[] } }),
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
    recipientId: row.id,
    recipientKind: 'TEAM_MEMBER' as const,
    teamMemberId: row.id,
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
  if (source === 'TEAM') {
    return resolveEventTeamCandidates(filter, limit);
  }
  if (source === 'MANUAL_SELECTION') {
    const selectedIds = toArray((filter as any)?.selectedUserIds ?? (filter as any)?.recipientIds);
    const prefillContacts = Array.isArray((filter as any)?.prefillContacts) ? (filter as any).prefillContacts : [];
    const prefillById = new Map(prefillContacts.map((x: any) => [String(x.id), x]));
    const userIds = selectedIds.filter(id => !id.startsWith('prefill-'));
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: userSelect() as any })
      : [];
    const usersById = new Map(users.map((u: any) => [u.id, u]));
    return selectedIds.map((id) => {
      if (id.startsWith('prefill-')) {
        const p = prefillById.get(id) ?? prefillById.get(id.replace(/^prefill-/, ''));
        return {
          id,
          recipientId: id,
          recipientKind: 'PREFILL_CONTACT' as const,
          prefillContactId: id,
          email: p?.email ?? null,
          name: p?.name ?? p?.fullName ?? null,
          city: null,
          isActive: true,
          emailVerifiedAt: new Date(),
          audienceReason: { matchedBy: 'manualSelectionPrefill' },
        };
      }
      const u = usersById.get(id);
      if (u) return { ...u, recipientId: id, recipientKind: 'USER' as const, audienceReason: { matchedBy: 'manualSelectionUser' } };
      return {
        id,
        recipientId: id,
        recipientKind: 'MANUAL_EMAIL' as const,
        email: null,
        name: null,
        city: null,
        isActive: true,
        emailVerifiedAt: new Date(),
        audienceReason: { matchedBy: 'manualSelectionUnknown' },
      };
    });
  }
  if (source === 'MANUAL_EMAIL') {
    const items = toArray(filter?.emails).map(email => ({ email }));
    return items.map((item, idx) => ({
      id: `manual-email-${idx}`,
      recipientId: `manual-email-${idx}`,
      recipientKind: 'MANUAL_EMAIL' as const,
      email: item.email,
      name: item.email,
      isActive: true,
      emailVerifiedAt: new Date(),
    }));
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
    const isExternalRecipient = user.recipientKind && user.recipientKind !== 'USER';
    const consent = isExternalRecipient ? { allowed: true, optedOut: false, topics: [] as string[] } : consentDecision(user, type);
    const consentSnap = isExternalRecipient ? { externalRecipient: true } : consentSnapshot(user);
    const variables = buildDefaultRecipientVariables({
      userId: user.id,
      email,
      name: user.name,
      broadcastId: input.broadcastId ?? null,
      topic: type,
    }) as Record<string, string>;

    let status = 'QUEUED';
    let skipReasonCode: string | null = null;
    let skipReasonText: string | null = null;

    if (!email) {
      status = 'SKIPPED_NO_EMAIL';
      skipReasonCode = 'NO_EMAIL';
      skipReasonText = 'Email is missing.';
    } else if (!EMAIL_REGEX.test(email)) {
      status = 'SKIPPED_INVALID_EMAIL';
      skipReasonCode = 'INVALID_EMAIL';
      skipReasonText = 'Email format is invalid.';
    } else if (!user.isActive) {
      status = 'SKIPPED_BLOCKED';
      skipReasonCode = 'USER_DISABLED';
      skipReasonText = 'User account is inactive.';
    } else if (!isExternalRecipient && requiresVerifiedEmail(type, audienceKind, filter) && !user.emailVerifiedAt) {
      status = 'SKIPPED_EMAIL_NOT_VERIFIED';
      skipReasonCode = 'EMAIL_NOT_VERIFIED';
      skipReasonText = 'Email is not verified.';
    } else if (suppressionByEmail.has(normalizedEmail)) {
      status = 'SKIPPED_SUPPRESSED';
      skipReasonCode = 'SUPPRESSED_EMAIL';
      skipReasonText = `Email is suppressed: ${suppressionByEmail.get(normalizedEmail)}`;
    } else if (!isExternalRecipient && consent.optedOut) {
      status = 'SKIPPED_UNSUBSCRIBED';
      skipReasonCode = 'UNSUBSCRIBED';
      skipReasonText = 'User opted out of this communication topic.';
    } else if (!isExternalRecipient && !consent.allowed) {
      status = 'SKIPPED_NO_CONSENT';
      skipReasonCode = 'NO_MARKETING_CONSENT';
      skipReasonText = 'No explicit consent for this communication topic.';
    } else if (seenEmails.has(normalizedEmail)) {
      status = 'SKIPPED_DUPLICATE_EMAIL';
      skipReasonCode = 'DUPLICATE_RECIPIENT';
      skipReasonText = 'Duplicate email in this audience.';
    }

    if (!status.startsWith('SKIPPED') && normalizedEmail) {
      seenEmails.add(normalizedEmail);
    }

    return {
      recipientId: user.recipientId ?? user.id,
      recipientKind: user.recipientKind ?? 'USER',
      userId: user.id,
      teamMemberId: user.teamMemberId ?? null,
      email: email || undefined,
      normalizedEmail: normalizedEmail || undefined,
      name: user.name ?? undefined,
      firstName: user.name?.split(/\s+/).filter(Boolean)[0] ?? null,
      lastName: user.name?.split(/\s+/).filter(Boolean).slice(1).join(' ') || null,
      avatarUrl: (user as any).avatarUrl ?? null,
      eligible: !status.startsWith('SKIPPED'),
      deliveryStatus: status,
      status,
      skipReasonCode,
      skipReasonText,
      skipReason: skipReasonText ?? undefined,
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
  if (eventId && ['STATIC_FILTER', 'EVENT_PARTICIPANTS', 'EVENT_TEAMS'].includes(source)) {
    return String(eventId);
  }
  return null;
}
