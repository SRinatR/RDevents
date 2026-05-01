import { prisma } from '../../db/prisma.js';

export type ProfileHistoryAction =
  | 'PROFILE_SECTION_UPDATED'
  | 'PROFILE_UPDATED'
  | 'PROFILE_AVATAR_UPLOADED'
  | 'PROFILE_DOCUMENT_UPLOADED'
  | 'PROFILE_DOCUMENT_DELETED';

export async function recordProfileHistory(input: {
  userId: string;
  actorUserId?: string | null;
  action: ProfileHistoryAction;
  sectionKey?: string | null;
  assetId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: Record<string, unknown>;
}) {
  const changedFields = diffSnapshotKeys(input.before, input.after);
  await prisma.userProfileHistory.create({
    data: {
      userId: input.userId,
      actorUserId: input.actorUserId ?? input.userId,
      action: input.action,
      sectionKey: input.sectionKey ?? null,
      assetId: input.assetId ?? null,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after),
      meta: {
        ...(input.meta ?? {}),
        ...(changedFields.length > 0 ? { changedFields } : {}),
      },
    },
  });
}

function diffSnapshotKeys(before: unknown, after: unknown) {
  if (!isRecord(before) || !isRecord(after)) return [];

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .sort();
}

function toJson(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
