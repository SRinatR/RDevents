import { prisma } from '../../db/prisma.js';
import { logger } from '../../common/logger.js';
import { buildPublicMediaUrl } from '../../common/storage.js';

export type ExportScope = 'participants' | 'volunteers' | 'teams' | 'team_members' | 'all';
export type ExportFormat = 'csv' | 'xlsx' | 'json';

export interface ExportConfig {
  scope: ExportScope;
  fields: string[];
  format: ExportFormat;
  filters?: {
    status?: string[];
    hasTeam?: boolean;
    hasPhoto?: boolean;
  };
}

export interface ExportPreset {
  id: string;
  eventId: string | null;
  scope: string;
  name: string;
  format: string;
  configJson: ExportConfig;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getExportPresets(eventId: string | null) {
  const presets = await prisma.exportPreset.findMany({
    where: {
      OR: [
        { eventId: eventId ?? undefined },
        { eventId: null },
      ],
    },
    orderBy: [
      { eventId: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  return presets.map(preset => ({
    ...preset,
    configJson: preset.configJson as unknown as ExportConfig,
  }));
}

export async function createExportPreset(
  data: {
    eventId: string | null;
    scope: string;
    name: string;
    format: string;
    config: ExportConfig;
  },
  createdById: string
) {
  const preset = await prisma.exportPreset.create({
    data: {
      eventId: data.eventId,
      scope: data.scope,
      name: data.name,
      format: data.format,
      configJson: data.config as unknown as any,
      createdById,
    },
  });

  return {
    ...preset,
    configJson: preset.configJson as unknown as ExportConfig,
  };
}

export async function updateExportPreset(
  presetId: string,
  data: {
    name?: string;
    format?: string;
    config?: ExportConfig;
  }
) {
  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.format !== undefined) updateData.format = data.format;
  if (data.config !== undefined) updateData.configJson = data.config as unknown as any;

  const preset = await prisma.exportPreset.update({
    where: { id: presetId },
    data: updateData,
  });

  return {
    ...preset,
    configJson: preset.configJson as unknown as ExportConfig,
  };
}

export async function deleteExportPreset(presetId: string) {
  await prisma.exportPreset.delete({
    where: { id: presetId },
  });
}

export interface ParticipantExportRow {
  eventId: string;
  eventTitle: string;
  memberId: string;
  userId: string;
  participantRole: string;
  participantStatus: string;
  assignedAt: string;
  approvedAt: string;
  rejectedAt: string;
  removedAt: string;
  notes: string;
  registrationAnswersJson: string;
  lastNameCyrillic: string;
  firstNameCyrillic: string;
  middleNameCyrillic: string;
  lastNameLatin: string;
  firstNameLatin: string;
  fullNameCyrillic: string;
  fullNameLatin: string;
  email: string;
  phone: string;
  telegram: string;
  birthDate: string;
  city: string;
  gender: string;
  nativeLanguage: string;
  communicationLanguage: string;
  bio: string;
  avatarUrl: string;
  teamId: string;
  teamName: string;
  teamStatus: string;
  teamRole: string;
  teamMemberStatus: string;
}

export interface TeamExportRow {
  teamId: string;
  teamName: string;
  teamStatus: string;
  description: string;
  eventId: string;
  eventTitle: string;
  captainUserId: string;
  captainName: string;
  captainEmail: string;
  membersCountAll: number;
  membersCountActive: number;
  memberUserIds: string;
  memberNames: string;
  memberEmails: string;
  createdAt: string;
}

export interface TeamMemberExportRow {
  eventId: string;
  eventTitle: string;
  teamId: string;
  teamName: string;
  teamStatus: string;
  userId: string;
  userName: string;
  userEmail: string;
  teamRole: string;
  teamMemberStatus: string;
  joinedAt: string;
}

interface ExtendedExportFilters {
  status?: string[];
  hasTeam?: boolean;
  hasPhoto?: boolean;
  includeArchived?: boolean;
  includeRejected?: boolean;
  includeCancelled?: boolean;
  includeRemoved?: boolean;
}

export async function exportParticipants(eventId: string, config: { filters?: ExtendedExportFilters }) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });

  if (!event) {
    throw new Error('Event not found');
  }

  const statusFilter = config.filters?.status;
  const includeArchived = config.filters?.includeArchived ?? false;
  const includeRejected = config.filters?.includeRejected ?? true;
  const includeCancelled = config.filters?.includeCancelled ?? true;
  const includeRemoved = config.filters?.includeRemoved ?? false;

  const statusWhere: string[] = [];
  if (statusFilter && statusFilter.length > 0) {
    statusWhere.push(...statusFilter);
  } else {
    if (!includeArchived) statusWhere.push('ACTIVE', 'PENDING', 'APPROVED');
    if (includeRejected) statusWhere.push('REJECTED');
    if (includeCancelled) statusWhere.push('CANCELLED');
    if (includeRemoved) statusWhere.push('REMOVED');
  }

  const members = await prisma.eventMember.findMany({
    where: {
      eventId,
      role: 'PARTICIPANT',
      ...(statusWhere.length > 0 ? { status: { in: statusWhere } } : {}),
    } as any,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          lastNameCyrillic: true,
          firstNameCyrillic: true,
          middleNameCyrillic: true,
          lastNameLatin: true,
          firstNameLatin: true,
          fullNameCyrillic: true,
          fullNameLatin: true,
          birthDate: true,
          phone: true,
          telegram: true,
          city: true,
          gender: true,
          nativeLanguage: true,
          communicationLanguage: true,
          bio: true,
          avatarUrl: true,
        },
      },
      event: { select: { id: true, title: true } },
    },
  });

  const teamMemberships = await prisma.eventTeamMember.findMany({
    where: {
      team: { eventId },
      ...(includeRemoved ? {} : { status: { notIn: ['REMOVED', 'LEFT'] } }),
    },
    include: {
      team: { select: { id: true, name: true, status: true } },
    },
  });

  const membershipMap = new Map<string, typeof teamMemberships[0]>();
  for (const m of teamMemberships) {
    membershipMap.set(m.userId, m);
  }

  const submissions = await prisma.eventRegistrationFormSubmission.findMany({
    where: { eventId },
    select: { userId: true, answersJson: true },
  });
  const submissionMap = new Map(submissions.map(s => [s.userId, s.answersJson]));

  return members
    .filter(p => {
      if (config.filters?.hasTeam === true && !membershipMap.has(p.userId)) return false;
      if (config.filters?.hasTeam === false && membershipMap.has(p.userId)) return false;
      return true;
    })
    .map(p => {
      const tm = membershipMap.get(p.userId);
      const registrationAnswers = submissionMap.get(p.userId) || '';

      return {
        eventId: event.id,
        eventTitle: event.title,
        memberId: p.id,
        userId: p.user.id,
        participantRole: p.role,
        participantStatus: p.status,
        assignedAt: p.assignedAt?.toISOString() ?? '',
        approvedAt: p.approvedAt?.toISOString() ?? '',
        rejectedAt: p.rejectedAt?.toISOString() ?? '',
        removedAt: p.removedAt?.toISOString() ?? '',
        notes: p.notes ?? '',
        registrationAnswersJson: typeof registrationAnswers === 'string' ? registrationAnswers : JSON.stringify(registrationAnswers),
        lastNameCyrillic: p.user.lastNameCyrillic ?? '',
        firstNameCyrillic: p.user.firstNameCyrillic ?? '',
        middleNameCyrillic: p.user.middleNameCyrillic ?? '',
        lastNameLatin: p.user.lastNameLatin ?? '',
        firstNameLatin: p.user.firstNameLatin ?? '',
        fullNameCyrillic: p.user.fullNameCyrillic ?? '',
        fullNameLatin: p.user.fullNameLatin ?? '',
        email: p.user.email,
        phone: p.user.phone ?? '',
        telegram: p.user.telegram ?? '',
        birthDate: p.user.birthDate ? new Date(p.user.birthDate).toISOString().split('T')[0] : '',
        city: p.user.city ?? '',
        gender: p.user.gender ?? '',
        nativeLanguage: p.user.nativeLanguage ?? '',
        communicationLanguage: p.user.communicationLanguage ?? '',
        bio: p.user.bio ?? '',
        avatarUrl: p.user.avatarUrl ?? '',
        teamId: tm?.team?.id ?? '',
        teamName: tm?.team?.name ?? '',
        teamStatus: tm?.team?.status ?? '',
        teamRole: tm?.role ?? '',
        teamMemberStatus: tm?.status ?? '',
      };
    });
}

export async function exportTeams(eventId: string, config: { filters?: ExtendedExportFilters }) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });

  if (!event) {
    throw new Error('Event not found');
  }

  const includeArchived = config.filters?.includeArchived ?? false;
  const includeRejected = config.filters?.includeRejected ?? true;
  const includeCancelled = config.filters?.includeCancelled ?? true;

  const statusWhere: Record<string, unknown> = {};
  const statusList: string[] = [];
  if (!includeArchived) statusList.push('ACTIVE', 'PENDING', 'SUBMITTED', 'DRAFT');
  if (includeRejected) statusList.push('REJECTED', 'CHANGES_PENDING');
  if (includeCancelled) statusList.push('ARCHIVED');
  if (statusList.length > 0) {
    statusWhere['status'] = { in: statusList };
  }

  const teams = await prisma.eventTeam.findMany({
    where: { eventId, ...statusWhere },
    include: {
      captainUser: {
        select: { id: true, name: true, email: true },
      },
      members: {
        where: { status: { notIn: ['REMOVED', 'LEFT'] } },
        select: {
          id: true,
          userId: true,
          role: true,
          status: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return teams.map(t => {
    const memberIds = t.members.map(m => m.userId);
    const memberNames = t.members.map(m => m.user?.name ?? '').filter(Boolean);
    const memberEmails = t.members.map(m => m.user?.email ?? '').filter(Boolean);
    const activeCount = t.members.filter(m => m.status === 'ACTIVE').length;

    return {
      teamId: t.id,
      teamName: t.name,
      teamStatus: t.status,
      description: t.description ?? '',
      eventId: event.id,
      eventTitle: event.title,
      captainUserId: t.captainUserId ?? '',
      captainName: t.captainUser?.name ?? '',
      captainEmail: t.captainUser?.email ?? '',
      membersCountAll: t.members.length,
      membersCountActive: activeCount,
      memberUserIds: memberIds.join('; '),
      memberNames: memberNames.join('; '),
      memberEmails: memberEmails.join('; '),
      createdAt: t.createdAt.toISOString(),
    };
  });
}

export async function exportTeamMembers(eventId: string, config: { filters?: ExtendedExportFilters }) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });

  if (!event) {
    throw new Error('Event not found');
  }

  const includeArchived = config.filters?.includeArchived ?? false;
  const includeRejected = config.filters?.includeRejected ?? true;
  const includeCancelled = config.filters?.includeCancelled ?? true;

  const teamStatusList: string[] = [];
  if (!includeArchived) teamStatusList.push('ACTIVE', 'PENDING', 'SUBMITTED', 'DRAFT');
  if (includeRejected) teamStatusList.push('REJECTED', 'CHANGES_PENDING');
  if (includeCancelled) teamStatusList.push('ARCHIVED');

  const memberStatusList: string[] = [];
  if (!includeArchived) memberStatusList.push('ACTIVE', 'PENDING');
  if (includeRejected) memberStatusList.push('REJECTED');

  const whereCondition: Record<string, unknown> = {
    team: { eventId },
    ...(teamStatusList.length > 0 ? { team: { status: { in: teamStatusList } } } : {}),
    ...(memberStatusList.length > 0 ? { status: { in: memberStatusList } } : {}),
  };

  const teamMembers = await prisma.eventTeamMember.findMany({
    where: whereCondition as any,
    include: {
      team: { select: { id: true, name: true, status: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return teamMembers.map(m => ({
    eventId: event.id,
    eventTitle: event.title,
    teamId: m.team.id,
    teamName: m.team.name,
    teamStatus: m.team.status,
    userId: m.user.id,
    userName: m.user.name ?? '',
    userEmail: m.user.email,
    teamRole: m.role,
    teamMemberStatus: m.status,
    joinedAt: m.joinedAt.toISOString(),
  }));
}
  export interface AvatarBundleResult {
  jobId: string;
  format: string;
  contains: string[];
  participants: Array<{
    userId: string;
    fullNameCyrillic: string;
    fullNameLatin: string;
    teamName: string | null;
    role: string;
    status: string;
    avatarFilename: string;
    avatarUrl: string | null;
    missingAvatar: boolean;
  }>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function generateAvatarBundle(
  eventId: string,
  options: {
    includeApprovedOnly?: boolean;
    includeTeamsOnly?: boolean;
    includeVolunteers?: boolean;
  } = {}
) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true },
  });

  if (!event) {
    throw new Error('EVENT_NOT_FOUND');
  }

  const participants = await prisma.eventMember.findMany({
    where: {
      eventId,
      role: options.includeVolunteers ? { in: ['PARTICIPANT', 'VOLUNTEER'] } : { equals: 'PARTICIPANT' },
    },
    include: {
      user: {
        select: {
          id: true,
          lastNameCyrillic: true,
          firstNameCyrillic: true,
          middleNameCyrillic: true,
          lastNameLatin: true,
          firstNameLatin: true,
          fullNameCyrillic: true,
          fullNameLatin: true,
          avatarUrl: true,
          avatarAsset: true,
        },
      },
    },
  });

  const teamMemberships = await prisma.eventTeamMember.findMany({
    where: {
      team: { eventId },
      status: { notIn: ['REMOVED', 'LEFT'] },
    },
    include: {
      team: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const membershipMap = new Map(
    teamMemberships.map(m => [m.userId, m])
  );

  const jobId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const manifest = participants.map(p => {
    const firstName = p.user.firstNameLatin || p.user.firstNameCyrillic || '';
    const lastName = p.user.lastNameLatin || p.user.lastNameCyrillic || '';
    const teamMember = membershipMap.get(p.userId);
    const teamPrefix = teamMember?.team?.name ? slugify(teamMember.team.name) + '_' : 'no_team_';
    const avatarFilename = `${teamPrefix}${slugify(lastName)}_${slugify(firstName)}_${p.user.id}.jpg`;
    const hasAvatar = !!(p.user.avatarUrl || p.user.avatarAsset);
    const avatarUrl = p.user.avatarUrl ?? (p.user.avatarAsset ? buildPublicMediaUrl((p.user.avatarAsset as any).storageKey) : null);

    return {
      userId: p.user.id,
      fullNameCyrillic: p.user.fullNameCyrillic ?? `${p.user.lastNameCyrillic ?? ''} ${p.user.firstNameCyrillic ?? ''}`.trim(),
      fullNameLatin: p.user.fullNameLatin ?? `${p.user.lastNameLatin ?? ''} ${p.user.firstNameLatin ?? ''}`.trim(),
      teamName: teamMember?.team?.name ?? null,
      role: p.role,
      status: p.status,
      avatarFilename,
      avatarUrl,
      missingAvatar: !hasAvatar,
    };
  });

  logger.info('Avatar bundle generated', {
    module: 'exports',
    action: 'AVATAR_BUNDLE_GENERATED',
    meta: {
      jobId,
      eventId,
      eventTitle: event.title,
      participantsCount: manifest.length,
      withAvatarsCount: manifest.filter(m => !m.missingAvatar).length,
      withoutAvatarsCount: manifest.filter(m => m.missingAvatar).length,
    },
  });

  return {
    jobId,
    format: 'zip',
    contains: ['avatars/', 'manifest.csv', 'manifest.xlsx'],
    participants: manifest,
  };
}

export function generateCsvContent(data: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col];
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

export function generateJsonContent(data: Record<string, unknown>[]): string {
  return JSON.stringify(data, null, 2);
}
