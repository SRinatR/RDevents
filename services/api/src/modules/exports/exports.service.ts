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
  id: string;
  email: string;
  lastNameCyrillic: string;
  firstNameCyrillic: string;
  middleNameCyrillic: string;
  lastNameLatin: string;
  firstNameLatin: string;
  birthDate: string;
  phone: string;
  telegram: string;
  teamName: string;
  teamStatus: string;
  participantStatus: string;
  registeredAt: string;
  hasPhoto: boolean;
  photoUrl: string;
}

export async function exportParticipants(eventId: string, config: ExportConfig) {
  const participants = await prisma.eventMember.findMany({
    where: {
      eventId,
      role: 'PARTICIPANT',
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
          birthDate: true,
          phone: true,
          telegram: true,
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
          status: true,
        },
      },
    },
  });

  const membershipMap = new Map(
    teamMemberships.map(m => [m.userId, m])
  );

  const rows = participants
    .filter(p => {
      if (config.filters?.hasTeam === true && !membershipMap.has(p.userId)) return false;
      if (config.filters?.hasTeam === false && membershipMap.has(p.userId)) return false;
      const hasPhoto = !!(p.user.avatarUrl || p.user.avatarAsset);
      if (config.filters?.hasPhoto === true && !hasPhoto) return false;
      if (config.filters?.hasPhoto === false && hasPhoto) return false;
      return true;
    })
    .map(p => {
      const teamMember = membershipMap.get(p.userId);
      return {
        id: p.user.id,
        email: p.user.email,
        lastNameCyrillic: p.user.lastNameCyrillic ?? '',
        firstNameCyrillic: p.user.firstNameCyrillic ?? '',
        middleNameCyrillic: p.user.middleNameCyrillic ?? '',
        lastNameLatin: p.user.lastNameLatin ?? '',
        firstNameLatin: p.user.firstNameLatin ?? '',
        birthDate: p.user.birthDate ? new Date(p.user.birthDate).toLocaleDateString() : '',
        phone: p.user.phone ?? '',
        telegram: p.user.telegram ?? '',
        teamName: teamMember?.team?.name ?? '',
        teamStatus: teamMember?.team?.status ?? '',
        participantStatus: p.status,
        registeredAt: new Date(p.assignedAt).toLocaleDateString(),
        hasPhoto: !!(p.user.avatarUrl || p.user.avatarAsset),
        photoUrl: p.user.avatarUrl ?? (p.user.avatarAsset ? buildPublicMediaUrl((p.user.avatarAsset as any).storageKey) : ''),
      };
    });

  return rows;
}

export interface TeamExportRow {
  id: string;
  name: string;
  description: string;
  captainName: string;
  captainEmail: string;
  membersCount: number;
  status: string;
  createdAt: string;
}

export async function exportTeams(eventId: string, config: ExportConfig) {
  const teams = await prisma.eventTeam.findMany({
    where: {
      eventId,
    },
    include: {
      captainUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      members: {
        where: { status: { notIn: ['REMOVED', 'LEFT'] } },
        select: { id: true },
      },
    },
  });

  const rows = teams.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description ?? '',
    captainName: t.captainUser?.name ?? '',
    captainEmail: t.captainUser?.email ?? '',
    membersCount: t.members.length,
    status: t.status,
    createdAt: new Date(t.createdAt).toLocaleDateString(),
  }));

  return rows;
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
