import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '../../db/prisma.js';

vi.mock('../../db/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
    },
    eventMember: {
      findMany: vi.fn(),
    },
    eventTeamMember: {
      findMany: vi.fn(),
    },
    emailSuppression: {
      findMany: vi.fn(),
    },
  },
}));

describe('audience-resolver skip reasons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SKIPPED_NO_EMAIL', () => {
    it('marks user as SKIPPED_NO_EMAIL when email is empty', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: null,
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SKIPPED_NO_EMAIL');
      expect(result.items[0].skipReason).toBe('Email is missing.');
    });

    it('marks user as SKIPPED_NO_EMAIL when email is empty string', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: '',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SKIPPED_NO_EMAIL');
    });
  });

  describe('SKIPPED_INVALID_EMAIL', () => {
    it('marks user as SKIPPED_INVALID_EMAIL for malformed email', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'not-an-email',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SKIPPED_INVALID_EMAIL');
      expect(result.items[0].skipReason).toBe('Email format is invalid.');
    });
  });

  describe('SKIPPED_EMAIL_NOT_VERIFIED', () => {
    it('marks user as SKIPPED_EMAIL_NOT_VERIFIED when email not verified for MARKETING', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: null,
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SKIPPED_EMAIL_NOT_VERIFIED');
      expect(result.items[0].skipReason).toBe('Email is not verified.');
    });
  });

  describe('SKIPPED_SUPPRESSED', () => {
    it('marks user as SKIPPED_SUPPRESSED when email is in suppression list', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([
        { normalizedEmail: 'user@example.com', reason: 'BOUNCED' },
      ] as any);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SKIPPED_SUPPRESSED');
      expect(result.items[0].skipReason).toContain('suppressed');
    });
  });

  describe('SKIPPED_UNSUBSCRIBED', () => {
    it('marks user as SKIPPED_UNSUBSCRIBED when opted out of MARKETING', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: false },
          communicationConsents: [
            { channel: 'EMAIL', topic: 'MARKETING', status: 'OPTED_OUT', optedInAt: null, optedOutAt: new Date(), lastChangedAt: new Date() },
          ],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SKIPPED_UNSUBSCRIBED');
      expect(result.items[0].skipReason).toContain('opted out');
    });
  });

  describe('SKIPPED_NO_CONSENT', () => {
    it('marks user as SKIPPED_NO_CONSENT when no explicit consent and no legacy consent', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: false },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('SKIPPED_NO_CONSENT');
      expect(result.items[0].skipReason).toContain('No explicit consent');
    });
  });

  describe('SKIPPED_DUPLICATE_EMAIL', () => {
    it('marks second user as SKIPPED_DUPLICATE_EMAIL for duplicate email', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User 1',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
        {
          id: 'user-2',
          email: 'user@example.com',
          name: 'Test User 2',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].status).toBe('QUEUED');
      expect(result.items[0].eligible).toBe(true);
      expect(result.items[1].status).toBe('SKIPPED_DUPLICATE_EMAIL');
      expect(result.items[1].skipReason).toContain('Duplicate email');
    });
  });

  describe('eligible users', () => {
    it('marks user as QUEUED when all checks pass', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].status).toBe('QUEUED');
      expect(result.items[0].eligible).toBe(true);
      expect(result.items[0].skipReason).toBeUndefined();
    });

    it('counts eligible and skipped correctly', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Test User 1',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
        {
          id: 'user-2',
          email: '',
          name: 'Test User 2',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
        {
          id: 'user-3',
          email: 'bounced@example.com',
          name: 'Test User 3',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([
        { normalizedEmail: 'bounced@example.com', reason: 'BOUNCED' },
      ] as any);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'MARKETING',
        audienceKind: 'MAILING_CONSENT',
        audienceSource: 'STATIC_FILTER',
        includeSkipped: true,
      });

      expect(result.totalMatched).toBe(3);
      expect(result.totalEligible).toBe(1);
      expect(result.totalSkipped).toBe(2);
      expect(result.skippedByReason['SKIPPED_NO_EMAIL']).toBe(1);
      expect(result.skippedByReason['SKIPPED_SUPPRESSED']).toBe(1);
    });
  });

  describe('manual selection', () => {
    it('matches existing users by email and user id without duplicates', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@example.com',
          name: 'Selected User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);

      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'ADMIN_TEST',
        audienceKind: 'ACTIVE_USERS',
        audienceSource: 'MANUAL_SELECTION',
        audienceFilterJson: {
          emails: ['User <user@example.com>'],
          userIds: ['user-1'],
        },
        includeSkipped: true,
      });

      expect(result.totalMatched).toBe(1);
      expect(result.totalEligible).toBe(1);
      expect(result.items[0].userId).toBe('user-1');
      expect(result.items[0].status).toBe('QUEUED');
      expect(result.items[0].audienceReason).toMatchObject({
        matchedBy: 'manualSelection',
      });
    });

    it('keeps raw manual emails for platform-wide operational sends', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([]);
      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'ADMIN_TEST',
        audienceKind: 'ACTIVE_USERS',
        audienceSource: 'MANUAL_SELECTION',
        audienceFilterJson: {
          emails: ['external@example.com'],
        },
        includeSkipped: true,
      });

      expect(result.totalMatched).toBe(1);
      expect(result.items[0].userId).toBeUndefined();
      expect(result.items[0].email).toBe('external@example.com');
      expect(result.items[0].status).toBe('QUEUED');
    });

    it('restricts event-scoped manual selection to users from that event', async () => {
      vi.mocked(prisma.user.findMany).mockResolvedValue([
        {
          id: 'user-1',
          email: 'inside@example.com',
          name: 'Inside User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
        {
          id: 'user-2',
          email: 'outside@example.com',
          name: 'Outside User',
          isActive: true,
          emailVerifiedAt: new Date(),
          extendedProfile: { consentMailing: true },
          communicationConsents: [],
        },
      ] as any);
      vi.mocked(prisma.eventMember.findMany).mockResolvedValue([{ userId: 'user-1' }] as any);
      vi.mocked(prisma.eventTeamMember.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.emailSuppression.findMany).mockResolvedValue([]);

      const { resolveAudience } = await import('./audience-resolver.service.js');
      const result = await resolveAudience({
        broadcastType: 'ADMIN_TEST',
        audienceKind: 'ACTIVE_USERS',
        audienceSource: 'MANUAL_SELECTION',
        audienceFilterJson: {
          eventId: 'event-1',
          userIds: ['user-1', 'user-2'],
          emails: ['outside@example.com', 'raw@example.com'],
        },
        includeSkipped: true,
      });

      expect(result.totalMatched).toBe(1);
      expect(result.totalEligible).toBe(1);
      expect(result.items[0].userId).toBe('user-1');
      expect(result.items[0].email).toBe('inside@example.com');
    });
  });
});
