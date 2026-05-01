import JSZip from 'jszip';
import { prisma } from '../../db/prisma.js';
import { logger } from '../../common/logger.js';
import { buildPublicMediaUrl, readStoredFile } from '../../common/storage.js';
import type { EventTeamStatus } from '@prisma/client';

export type ExportScope = 'participants' | 'volunteers' | 'teams' | 'team_members' | 'all';
export type ExportFormat = 'csv' | 'json';

export interface ExportConfig {
  scope: ExportScope;
  fields: string[];
  format: ExportFormat;
  filters?: {
    status?: string[];
    hasTeam?: boolean;
    hasPhoto?: boolean;
    includeArchived?: boolean;
    includeRejected?: boolean;
    includeCancelled?: boolean;
    includeRemoved?: boolean;
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
  middleNameLatin: string;
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
  Фото: string;
  avatarUrl: string;
  teamId: string;
  teamName: string;
  teamStatus: string;
  teamRole: string;
  teamMemberStatus: string;
  teamMembers: string;
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

function resolveAvatarUrl(user: {
  avatarUrl?: string | null;
  avatarAsset?: { storageKey?: string | null; publicUrl?: string | null } | null;
}) {
  if (user.avatarAsset?.storageKey) return buildPublicMediaUrl(user.avatarAsset.storageKey);
  return user.avatarAsset?.publicUrl ?? user.avatarUrl ?? null;
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
  const includeRejected = config.filters?.includeRejected ?? false;
  const includeCancelled = config.filters?.includeCancelled ?? false;
  const includeRemoved = config.filters?.includeRemoved ?? false;

  const statusWhere: string[] = [];
  if (statusFilter && statusFilter.length > 0) {
    statusWhere.push(...statusFilter);
  } else {
    if (!includeArchived) statusWhere.push('ACTIVE', 'PENDING', 'RESERVE');
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
          middleNameLatin: true,
          fullNameCyrillic: true,
          fullNameLatin: true,
          birthDate: true,
          phone: true,
          telegram: true,
          city: true,
          nativeLanguage: true,
          communicationLanguage: true,
          bio: true,
          avatarUrl: true,
          avatarAsset: { select: { storageKey: true, publicUrl: true } },
          extendedProfile: {
            select: {
              gender: true,
            },
          },
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
      team: {
        select: {
          id: true,
          name: true,
          status: true,
          members: {
            where: includeRemoved ? {} : { status: { notIn: ['REMOVED', 'LEFT'] } },
            select: {
              role: true,
              status: true,
              user: {
                select: {
                  name: true,
                  fullNameCyrillic: true,
                  fullNameLatin: true,
                  email: true,
                },
              },
            },
            orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
          },
        },
      },
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
      const avatarUrl = resolveAvatarUrl(p.user);
      if (config.filters?.hasPhoto === true && !avatarUrl) return false;
      if (config.filters?.hasPhoto === false && avatarUrl) return false;
      return true;
    })
    .map(p => {
      const tm = membershipMap.get(p.userId);
      const registrationAnswers = submissionMap.get(p.userId) || '';
      const avatarUrl = resolveAvatarUrl(p.user);
      const teamMembers = tm?.team?.members
        ?.map(member => member.user.fullNameCyrillic ?? member.user.fullNameLatin ?? member.user.name ?? member.user.email)
        .filter(Boolean)
        .join('; ') ?? '';

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
        middleNameLatin: p.user.middleNameLatin ?? '',
        fullNameCyrillic: p.user.fullNameCyrillic ?? '',
        fullNameLatin: p.user.fullNameLatin ?? '',
        email: p.user.email,
        phone: p.user.phone ?? '',
        telegram: p.user.telegram ?? '',
        birthDate: p.user.birthDate ? new Date(p.user.birthDate).toISOString().split('T')[0] : '',
        city: p.user.city ?? '',
        gender: p.user.extendedProfile?.gender ?? '',
        nativeLanguage: p.user.nativeLanguage ?? '',
        communicationLanguage: p.user.communicationLanguage ?? '',
        bio: p.user.bio ?? '',
        Фото: avatarUrl ?? '',
        avatarUrl: avatarUrl ?? '',
        teamId: tm?.team?.id ?? '',
        teamName: tm?.team?.name ?? '',
        teamStatus: tm?.team?.status ?? '',
        teamRole: tm?.role ?? '',
        teamMemberStatus: tm?.status ?? '',
        teamMembers,
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
  const includeRejected = config.filters?.includeRejected ?? false;

  const statusList: EventTeamStatus[] = ['ACTIVE', 'APPROVED', 'PENDING', 'SUBMITTED', 'DRAFT', 'CHANGES_PENDING', 'NEEDS_ATTENTION'];
  if (includeRejected) statusList.push('REJECTED');
  if (includeArchived) statusList.push('ARCHIVED');

  const teams = await prisma.eventTeam.findMany({
    where: {
      eventId,
      ...(statusList.length > 0 ? { status: { in: statusList } } : {}),
    },
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

  const explicitTeamStatuses = config.filters?.status;
  const includeArchived = config.filters?.includeArchived ?? false;
  const includeRejected = config.filters?.includeRejected ?? false;
  const includeRemoved = config.filters?.includeRemoved ?? false;

  const teamStatusList: string[] = explicitTeamStatuses?.length
    ? [...explicitTeamStatuses]
    : ['ACTIVE', 'APPROVED', 'PENDING', 'SUBMITTED', 'DRAFT', 'CHANGES_PENDING', 'NEEDS_ATTENTION'];
  if (!explicitTeamStatuses?.length && includeRejected) teamStatusList.push('REJECTED');
  if (!explicitTeamStatuses?.length && includeArchived) teamStatusList.push('ARCHIVED');

  const memberStatusList: string[] = ['ACTIVE', 'PENDING'];
  if (includeRejected) memberStatusList.push('REJECTED');
  if (includeRemoved) memberStatusList.push('REMOVED', 'LEFT');

  const whereCondition: Record<string, unknown> = {
    team: {
      eventId,
      ...(teamStatusList.length > 0 ? { status: { in: teamStatusList } } : {}),
    },
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
  format: 'zip';
  filename: string;
  buffer: Buffer;
  contains: string[];
  participants: Array<{
    userId: string;
    fullNameCyrillic: string;
    fullNameLatin: string;
    teamName: string | null;
    teamRole: string | null;
    participantRole: string;
    participantStatus: string;
    avatarFilename: string;
    missingAvatar: boolean;
    missingReason?: string;
  }>;
}

type AvatarBundleAsset = {
  id: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string | null;
  createdAt: Date;
  status?: string;
};

function safeArchiveSegment(value: string, fallback: string) {
  const cleaned = value
    .split('')
    .map(char => (char.charCodeAt(0) < 32 ? ' ' : char))
    .join('')
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}

function buildDisplayName(user: {
  email: string;
  lastNameCyrillic?: string | null;
  firstNameCyrillic?: string | null;
  middleNameCyrillic?: string | null;
  lastNameLatin?: string | null;
  firstNameLatin?: string | null;
  fullNameCyrillic?: string | null;
  fullNameLatin?: string | null;
}) {
  const cyrillic = user.fullNameCyrillic
    ?? [user.lastNameCyrillic, user.firstNameCyrillic, user.middleNameCyrillic].filter(Boolean).join(' ');
  if (cyrillic.trim()) return cyrillic.trim();
  const latin = user.fullNameLatin
    ?? [user.lastNameLatin, user.firstNameLatin].filter(Boolean).join(' ');
  return latin.trim() || user.email;
}

function getAssetExtension(asset: { originalFilename: string; mimeType: string; storageKey: string }) {
  const fromName = asset.originalFilename.match(/\.[a-zA-Z0-9]{2,8}$/)?.[0]?.toLowerCase();
  if (fromName) return fromName;
  const fromStorage = asset.storageKey.match(/\.[a-zA-Z0-9]{2,8}$/)?.[0]?.toLowerCase();
  if (fromStorage) return fromStorage;
  if (asset.mimeType === 'image/png') return '.png';
  if (asset.mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

function uniqueFilename(filename: string, used: Set<string>) {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const extension = filename.match(/\.[^.]+$/)?.[0] ?? '';
  const base = extension ? filename.slice(0, -extension.length) : filename;
  let index = 2;
  while (used.has(`${base}-${index}${extension}`)) index += 1;
  const next = `${base}-${index}${extension}`;
  used.add(next);
  return next;
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
      ...(options.includeApprovedOnly ? { status: { in: ['ACTIVE', 'APPROVED'] } } : {}),
    },
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
          avatarAssetId: true,
          avatarUrl: true,
          avatarAsset: {
            select: {
              id: true,
              storageKey: true,
              originalFilename: true,
              mimeType: true,
              sizeBytes: true,
              publicUrl: true,
              createdAt: true,
              status: true,
            },
          },
          mediaAssets: {
            where: { purpose: 'AVATAR', status: 'ACTIVE' },
            select: {
              id: true,
              storageKey: true,
              originalFilename: true,
              mimeType: true,
              sizeBytes: true,
              publicUrl: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
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
          status: true,
        },
      },
    },
  });

  const membershipMap = new Map(
    teamMemberships.map(m => [m.userId, m])
  );

  const jobId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const zip = new JSZip();
  const usedFilenames = new Set<string>();
  const manifest: AvatarBundleResult['participants'] = [];
  const manifestRows: Record<string, unknown>[] = [];
  const filteredParticipants = options.includeTeamsOnly
    ? participants.filter(p => membershipMap.has(p.userId))
    : participants;

  for (const p of filteredParticipants) {
    const teamMember = membershipMap.get(p.userId);
    const fullNameCyrillic = buildDisplayName(p.user);
    const fullNameLatin = p.user.fullNameLatin ?? `${p.user.lastNameLatin ?? ''} ${p.user.firstNameLatin ?? ''}`.trim();
    const teamName = teamMember?.team?.name ?? null;
    const teamRole = teamMember?.role ?? null;
    const assetsById = new Map<string, AvatarBundleAsset>();

    for (const asset of p.user.mediaAssets) assetsById.set(asset.id, asset);
    if (p.user.avatarAsset && p.user.avatarAsset.status === 'ACTIVE') {
      assetsById.set(p.user.avatarAsset.id, p.user.avatarAsset);
    }

    const assets = [...assetsById.values()].sort((a, b) => {
      if (a.id === p.user.avatarAssetId) return -1;
      if (b.id === p.user.avatarAssetId) return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    if (assets.length === 0) {
      const row = {
        userId: p.user.id,
        fullNameCyrillic,
        fullNameLatin,
        teamName,
        teamRole,
        participantRole: p.role,
        participantStatus: p.status,
        avatarFilename: '',
        missingAvatar: true,
        missingReason: 'NO_STORED_PROFILE_PHOTO',
      };
      manifest.push(row);
      manifestRows.push(row);
      continue;
    }

    for (const asset of assets) {
      const isCurrent = asset.id === p.user.avatarAssetId;
      const suffix = isCurrent
        ? 'текущее'
        : `история ${asset.createdAt.toISOString().slice(0, 10)}`;
      const baseName = safeArchiveSegment(
        `${fullNameCyrillic} ${teamName ?? 'без команды'}${teamRole === 'CAPTAIN' ? ' капитан' : ''} ${suffix}`,
        p.user.id
      );
      const avatarFilename = uniqueFilename(`${baseName}${getAssetExtension(asset)}`, usedFilenames);
      const row = {
        userId: p.user.id,
        fullNameCyrillic,
        fullNameLatin,
        teamName,
        teamRole,
        participantRole: p.role,
        participantStatus: p.status,
        avatarFilename,
        missingAvatar: false,
      };

      try {
        zip.file(`photos/${avatarFilename}`, await readStoredFile(asset.storageKey));
      } catch {
        row.missingAvatar = true;
        (row as typeof row & { missingReason: string }).missingReason = 'PHOTO_FILE_NOT_FOUND';
      }

      manifest.push(row);
      manifestRows.push({
        ...row,
        assetId: asset.id,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        uploadedAt: asset.createdAt.toISOString(),
      });
    }
  }

  zip.file('manifest.csv', `\ufeff${generateCsvContent(manifestRows, [
    'userId',
    'fullNameCyrillic',
    'fullNameLatin',
    'teamName',
    'teamRole',
    'participantRole',
    'participantStatus',
    'avatarFilename',
    'assetId',
    'originalFilename',
    'mimeType',
    'sizeBytes',
    'uploadedAt',
    'missingAvatar',
    'missingReason',
  ])}`);

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const filename = `event_${event.id}_photos.zip`;

  logger.info('Avatar bundle generated', {
    module: 'exports',
    action: 'AVATAR_BUNDLE_GENERATED',
    meta: {
      jobId,
      eventId,
      eventTitle: event.title,
      participantsCount: filteredParticipants.length,
      photosCount: manifest.filter(m => !m.missingAvatar).length,
      missingAvatarsCount: manifest.filter(m => m.missingAvatar).length,
    },
  });

  return {
    jobId,
    format: 'zip',
    filename,
    buffer,
    contains: ['photos/', 'manifest.csv'],
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
