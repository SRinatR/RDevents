import { prisma } from '../../db/prisma.js';
import type { Prisma } from '@prisma/client';
import { trackAnalyticsEvent } from '../analytics/analytics.service.js';
import { getProfileSnapshot } from '../auth/profile.snapshot.js';
import {
  notifyParticipantAnswersUpdated,
  notifyParticipantApplicationSubmitted,
  notifyParticipantStatusChanged,
} from './notifications.service.js';

const ACTIVE_MEMBER_STATUSES = ['ACTIVE'] as const;
const DEPRECATED_PROFILE_REQUIREMENT_FIELDS = new Set(['consentPersonalData', 'consentClientRules']);

const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: 'Full name',
  phone: 'Phone',
  city: 'City',
  factualAddress: 'Factual address',
  telegram: 'Telegram',
  nativeLanguage: 'Native language',
  communicationLanguage: 'Communication language',
  birthDate: 'Date of birth',
  avatarUrl: 'Avatar',
  bio: 'Bio',
  lastNameCyrillic: 'Last name (Cyrillic)',
  firstNameCyrillic: 'First name (Cyrillic)',
  middleNameCyrillic: 'Middle name (Cyrillic)',
  lastNameLatin: 'Last name (Latin)',
  firstNameLatin: 'First name (Latin)',
  middleNameLatin: 'Middle name (Latin)',
  gender: 'Gender',
  citizenshipCountryCode: 'Citizenship',
  residenceCountryCode: 'Residence country',
  regionId: 'Region',
  districtId: 'District',
  settlementId: 'Settlement',
  street: 'Street',
  house: 'House',
  postalCode: 'Postal code',
  domesticDocumentComplete: 'Domestic document',
  internationalPassportComplete: 'International passport',
  personalDocumentsComplete: 'Personal documents',
  contactDataComplete: 'Contact data',
  activityStatus: 'Activity status',
  organizationName: 'Organization',
  activityDirections: 'Activity directions',
  englishLevel: 'English level',
  russianLevel: 'Russian level',
};

const EVENT_FIELD_LABELS: Record<string, string> = {
  motivation: 'Motivation',
  experience: 'Experience',
  teamPreference: 'Team preference',
  tshirtSize: 'T-shirt size',
  emergencyContact: 'Emergency contact',
  preferredSlot: 'Preferred slot',
  specialRequirements: 'Special requirements',
  university: 'University',
  faculty: 'Faculty',
  course: 'Course',
};

export type RegistrationMissingField = {
  key: string;
  label: string;
  scope: 'PROFILE' | 'EVENT_FORM';
  action: 'PROFILE' | 'EVENT_FORM';
};

export class RegistrationRequirementsError extends Error {
  constructor(public missingFields: RegistrationMissingField[]) {
    super('REGISTRATION_REQUIREMENTS_MISSING');
  }
}

function hasValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

function normalizeAnswers(answers?: Record<string, unknown> | null) {
  return answers && typeof answers === 'object' ? answers : {};
}

function buildMissingProfileFields(user: Record<string, unknown>, requiredFields: string[]) {
  return requiredFields
    .filter(field => !DEPRECATED_PROFILE_REQUIREMENT_FIELDS.has(field))
    .filter(field => !hasValue(user[field]))
    .map(field => ({
      key: field,
      label: PROFILE_FIELD_LABELS[field] ?? field,
      scope: 'PROFILE' as const,
      action: 'PROFILE' as const,
    }));
}

function activeProfileRequirementFields(requiredFields: string[]) {
  return requiredFields.filter(field => !DEPRECATED_PROFILE_REQUIREMENT_FIELDS.has(field));
}

function buildMissingEventFields(answers: Record<string, unknown>, requiredFields: string[]) {
  return requiredFields
    .filter(field => !hasValue(answers[field]))
    .map(field => ({
      key: field,
      label: EVENT_FIELD_LABELS[field] ?? field,
      scope: 'EVENT_FORM' as const,
      action: 'EVENT_FORM' as const,
    }));
}

export function getEventFieldLabel(field: string) {
  return EVENT_FIELD_LABELS[field] ?? field;
}

export async function getRegistrationPrecheck(
  eventId: string,
  userId: string,
  answersInput?: Record<string, unknown>,
  options: { allowExistingParticipant?: boolean } = {}
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');
  if (!event.registrationEnabled) throw new Error('EVENT_NOT_AVAILABLE');
  if (event.registrationOpensAt && event.registrationOpensAt > new Date()) {
    throw new Error('REGISTRATION_NOT_OPEN');
  }
  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new Error('EVENT_NOT_AVAILABLE');
  }

  const [participantCount, existing, user, storedAnswers] = await Promise.all([
    prisma.eventMember.count({
      where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
    }),
    prisma.eventMember.findUnique({
      where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
    }),
    getProfileSnapshot(userId),
    prisma.eventRegistrationFormSubmission.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: { answersJson: true },
    }),
  ]);

  if (!user) throw new Error('USER_NOT_FOUND');
  if (existing && ACTIVE_MEMBER_STATUSES.includes(existing.status as any) && !options.allowExistingParticipant) {
    throw new Error('ALREADY_REGISTERED');
  }
  const eventAny = event as any;
  const target = eventAny.participantTarget ?? event.capacity;
  const isStrictLimit = eventAny.participantLimitMode === 'STRICT_LIMIT';
  if (isStrictLimit && participantCount >= target && !existing) throw new Error('EVENT_FULL');

  const answers = {
    ...normalizeAnswers(storedAnswers?.answersJson as Record<string, unknown> | undefined),
    ...normalizeAnswers(answersInput),
  };
  const requiredProfileFields = activeProfileRequirementFields(event.requiredProfileFields);
  const missingFields = [
    ...buildMissingProfileFields({ ...user, avatarUrl: user.avatarUrl ?? user.avatarAssetId }, requiredProfileFields),
    ...buildMissingEventFields(answers, event.requiredEventFields),
  ];

  return {
    ok: missingFields.length === 0,
    eventId,
    requiredProfileFields,
    requiredEventFields: event.requiredEventFields,
    missingFields,
    answers,
    registrationFieldLabels: Object.fromEntries(event.requiredEventFields.map(field => [field, getEventFieldLabel(field)])),
  };
}

export async function assertRegistrationRequirements(
  eventId: string,
  userId: string,
  answers?: Record<string, unknown>,
  options?: { allowExistingParticipant?: boolean }
) {
  const precheck = await getRegistrationPrecheck(eventId, userId, answers, options);
  if (!precheck.ok) throw new RegistrationRequirementsError(precheck.missingFields);
  return precheck;
}

export interface RegistrationResult {
  status: 'ACTIVE' | 'PENDING' | 'CAPACITY_REACHED' | 'GOAL_REACHED';
  membership?: {
    id: string;
    status: string;
    role: string;
  };
  participantCount?: number;
  participantTarget?: number | null;
  goalReached?: boolean;
  message: string;
}

export async function registerForEvent(eventId: string, userId: string, answers?: Record<string, unknown>): Promise<RegistrationResult> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  // Check timing gates
  if (event.status !== 'PUBLISHED') throw new Error('EVENT_NOT_AVAILABLE');
  if (!event.registrationEnabled) throw new Error('EVENT_NOT_AVAILABLE');
  if (event.registrationOpensAt && event.registrationOpensAt > new Date()) {
    throw new Error('REGISTRATION_NOT_OPEN');
  }
  if (event.registrationDeadline && event.registrationDeadline < new Date()) {
    throw new Error('EVENT_NOT_AVAILABLE');
  }

  const existing = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
  });

  // Already registered as ACTIVE
  if (existing && ACTIVE_MEMBER_STATUSES.includes(existing.status as any)) {
    throw new Error('ALREADY_REGISTERED');
  }

  // Has pending application
  if (existing && existing.status === 'PENDING') {
    throw new Error('ALREADY_HAS_PENDING_APPLICATION');
  }

  // Check capacity based on limit mode
  const activeCount = await prisma.eventMember.count({
    where: { eventId, role: 'PARTICIPANT', status: { in: [...ACTIVE_MEMBER_STATUSES] } },
  });

  // Type-safe access to new participation config fields
  const eventAny = event as any;
  const target = eventAny.participantTarget ?? event.capacity;
  const isStrictLimit = eventAny.participantLimitMode === 'STRICT_LIMIT';
  const isGoalLimit = eventAny.participantLimitMode === 'GOAL_LIMIT';

  // Strict limit check
  if (isStrictLimit && activeCount >= target) {
    if (eventAny.participantCountVisibility === 'PUBLIC') {
      throw { code: 'CAPACITY_REACHED', participantCount: activeCount, participantTarget: target };
    }
    throw new Error('CAPACITY_REACHED');
  }

  // Require approval mode - create PENDING application
  if (eventAny.requireParticipantApproval) {
    const precheck = await assertRegistrationRequirements(eventId, userId, answers);
    let savedMembership: { id: string; status: string; role: string } | undefined;
    
    await prisma.$transaction(async (tx: any) => {
      if (event.requiredEventFields.length > 0) {
        await tx.eventRegistrationFormSubmission.upsert({
          where: { eventId_userId: { eventId, userId } },
          create: {
            eventId,
            userId,
            answersJson: precheck.answers as Prisma.InputJsonValue,
            isComplete: true,
          },
          update: {
            answersJson: precheck.answers as Prisma.InputJsonValue,
          },
        });
      }

      if (existing) {
        savedMembership = await tx.eventMember.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING',
            assignedAt: new Date(),
            approvedAt: null,
            rejectedAt: null,
            removedAt: null,
          },
          select: { id: true, status: true, role: true },
        });
      } else {
        savedMembership = await tx.eventMember.create({
          data: {
            eventId,
            userId,
            role: 'PARTICIPANT',
            status: 'PENDING',
            assignedByUserId: userId,
          },
          select: { id: true, status: true, role: true },
        });
      }
    });

    await notifyParticipantApplicationSubmitted(eventId, userId, 'PENDING');

    return {
      status: 'PENDING',
      membership: savedMembership,
      participantCount: activeCount,
      participantTarget: target,
      message: 'Application submitted for review',
    };
  }

  // Auto-approve (no approval required)
  const precheck = await assertRegistrationRequirements(eventId, userId, answers);
  let savedMembership: { id: string; status: string; role: string } | undefined;

  await prisma.$transaction(async (tx: any) => {
    if (event.requiredEventFields.length > 0) {
      await tx.eventRegistrationFormSubmission.upsert({
        where: { eventId_userId: { eventId, userId } },
        create: {
          eventId,
          userId,
          answersJson: precheck.answers as Prisma.InputJsonValue,
          isComplete: true,
        },
        update: {
          answersJson: precheck.answers as Prisma.InputJsonValue,
        },
      });
    }

    if (existing) {
      savedMembership = await tx.eventMember.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          assignedAt: new Date(),
          approvedAt: new Date(),
          rejectedAt: null,
          removedAt: null,
        },
        select: { id: true, status: true, role: true },
      });
    } else {
      savedMembership = await tx.eventMember.create({
        data: {
          eventId,
          userId,
          role: 'PARTICIPANT',
          status: 'ACTIVE',
          assignedByUserId: userId,
          approvedAt: new Date(),
        },
        select: { id: true, status: true, role: true },
      });
    }

    // Only increment if we cross from inactive to active
    if (!existing || !ACTIVE_MEMBER_STATUSES.includes(existing.status as any)) {
      await tx.event.update({
        where: { id: eventId },
        data: { registrationsCount: { increment: 1 } },
      });
    }

    await trackAnalyticsEvent(tx, {
      type: 'EVENT_REGISTRATION',
      userId,
      eventId,
      authProvider: 'EMAIL',
      meta: { source: 'event_register' },
    });
  });

  await notifyParticipantApplicationSubmitted(eventId, userId, 'ACTIVE');

  const newActiveCount = activeCount + 1;
  const goalReached = isGoalLimit && newActiveCount >= target;

  return {
    status: goalReached ? 'GOAL_REACHED' : 'ACTIVE',
    membership: savedMembership,
    participantCount: newActiveCount,
    participantTarget: target,
    goalReached,
    message: goalReached ? 'Registered successfully. Goal participants reached.' : 'Registered successfully',
  };
}

export async function unregisterFromEvent(eventId: string, userId: string) {
  const membership = await prisma.eventMember.findUnique({
    where: { eventId_userId_role: { eventId, userId, role: 'PARTICIPANT' } },
  });
  if (!membership || membership.status === 'CANCELLED' || membership.status === 'REMOVED') {
    throw new Error('REGISTRATION_NOT_FOUND');
  }

  const teamMembership = await prisma.eventTeamMember.findFirst({
    where: {
      userId,
      team: { eventId },
      status: { notIn: ['REMOVED', 'LEFT'] },
    },
    include: { team: { select: { id: true, captainUserId: true } } },
  });

  if (teamMembership) {
    if (teamMembership.team.captainUserId === userId) {
      throw {
        code: 'CAPTAIN_CANNOT_CANCEL_EVENT_PARTICIPATION',
        message: 'сначала передайте капитанство или решите вопрос с командой',
      };
    }
  }

  const shouldDecrement = ACTIVE_MEMBER_STATUSES.includes(membership.status as any);

  const updated = await prisma.$transaction(async (tx: any) => {
    if (teamMembership) {
      await tx.eventTeamMember.update({
        where: { id: teamMembership.id },
        data: { status: 'LEFT', removedAt: new Date() },
      });
    }

    const updated = await tx.eventMember.update({
      where: { id: membership.id },
      data: {
        status: 'CANCELLED',
        removedAt: new Date(),
      },
    });

    if (shouldDecrement) {
      await tx.event.update({
        where: { id: eventId },
        data: { registrationsCount: { decrement: 1 } },
      });
    }

    return updated;
  });

  await notifyParticipantStatusChanged(eventId, userId, 'CANCELLED');
  return updated;
}

export async function getEventMembership(eventId: string, userId: string) {
  const [memberships, teamMembership] = await Promise.all([
    prisma.eventMember.findMany({
      where: {
        eventId,
        userId,
        status: { not: 'REMOVED' },
      },
      orderBy: { assignedAt: 'desc' },
    }),
    prisma.eventTeamMember.findFirst({
      where: {
        userId,
        team: { eventId },
        status: { notIn: ['REMOVED', 'LEFT'] },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            joinCode: true,
            status: true,
            captainUserId: true,
          },
        },
      },
    }),
  ]);

  return {
    memberships,
    teamMembership,
    isRegistered: memberships.some(
      membership => membership.role === 'PARTICIPANT' && ACTIVE_MEMBER_STATUSES.includes(membership.status as any)
    ),
  };
}

export async function saveRegistrationAnswers(eventId: string, userId: string, answers: Record<string, unknown>) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) throw new Error('EVENT_NOT_FOUND');

  const saved = await prisma.eventRegistrationFormSubmission.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: {
      eventId,
      userId,
      answersJson: normalizeAnswers(answers) as Prisma.InputJsonValue,
      isComplete: true,
    },
    update: {
      answersJson: normalizeAnswers(answers) as Prisma.InputJsonValue,
    },
  });

  await notifyParticipantAnswersUpdated(eventId, userId);
  return saved;
}
